// AutonomousControl.js
import React, { useState, useEffect, useContext, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Joystick } from "react-joystick-component";
import { useSocket } from "../../contexts/SocketContext";
import { BoatContext } from "../../contexts/BoatContext";
import "./AutonomousControl.css";

// Define icons for boats and target marker
const boatIcon = new L.Icon({
  iconUrl: "boat.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});
const selectedBoatIcon = new L.Icon({
  iconUrl: "boat.png",
  iconSize: [48, 48],
  iconAnchor: [24, 48],
  popupAnchor: [0, -48],
});
const selectedIcon = new L.Icon({
  iconUrl: "target-location.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const boatColors = {};
const getBoatColor = (boatId) => {
  if (!boatColors[boatId]) {
    boatColors[boatId] =
      "#" + ((Math.random() * 0xffffff) << 0).toString(16).padStart(6, "0");
  }
  return boatColors[boatId];
};

function AutonomousControl() {
  const { socket, isConnected, setCommandMode } = useSocket();
  const { boats } = useContext(BoatContext);

  const [targetBoatId, setTargetBoatId] = useState("");
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [mapCenter, setMapCenter] = useState([37.866942, -122.315452]);
  const [boatTrails, setBoatTrails] = useState({});
  const [notification, setNotification] = useState(null);

  const [rudder, setRudder] = useState(0);
  const [propeller, setPropeller] = useState(0);
  const rudderRef = useRef(0);
  const propellerRef = useRef(0);
  const controlIntervalId = useRef(null);
  const commandModeValue = "autonomous";
  const intervalTime = 500;
  const [boatDropdownOpen, setBoatDropdownOpen] = useState(false);

  useEffect(() => {
    if (setCommandMode) setCommandMode(commandModeValue);
  }, [setCommandMode]);

  useEffect(() => {
    const targetBoat = boats.find((b) => b.boat_id === targetBoatId);
    if (targetBoat && targetBoat.data) {
      setMapCenter([
        parseFloat(targetBoat.data.latitude.toFixed(6)),
        parseFloat(targetBoat.data.longitude.toFixed(6)),
      ]);
    }
  }, [boats, targetBoatId]);

  useEffect(() => {
    if (!targetBoatId && boats.length > 0) {
      setTargetBoatId(boats[0].boat_id);
    }
  }, [boats, targetBoatId]);

  useEffect(() => {
    const newBoatTrails = { ...boatTrails };
    boats.forEach((b) => {
      if (
        b.data &&
        typeof b.data.latitude === "number" &&
        typeof b.data.longitude === "number"
      ) {
        if (!newBoatTrails[b.boat_id]) newBoatTrails[b.boat_id] = [];
        newBoatTrails[b.boat_id].push([b.data.latitude, b.data.longitude]);
        if (newBoatTrails[b.boat_id].length > 50)
          newBoatTrails[b.boat_id].shift();
      }
    });
    setBoatTrails(newBoatTrails);
  }, [boats]);

  useEffect(() => {
    boats.forEach((b) => {
      if (
        b.data &&
        b.data.notification &&
        b.data.notification.id &&
        b.data.notification.type === "reached"
      ) {
        setNotification({
          id: b.data.notification.id,
          boat_id: b.boat_id,
          message: `${b.boat_id} has reached its destination.`,
        });
      }
    });
  }, [boats]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleMapClick = (e) => {
    const lat = parseFloat(e.latlng.lat.toFixed(6));
    const lng = parseFloat(e.latlng.lng.toFixed(6));
    setSelectedPosition({ latitude: lat, longitude: lng });
  };

  function ClickableMap() {
    useMapEvents({ click: handleMapClick });
    return null;
  }

  const sendRouteToCurrentBoat = () => {
    if (socket && isConnected && targetBoatId && selectedPosition) {
      const data = {
        id: targetBoatId,
        md: "auto",
        tlat: selectedPosition.latitude,
        tlng: selectedPosition.longitude,
      };
      socket.emit("gui_data", data);
      console.log("Sent route:", data);
    }
  };

  const copySelectedPosition = () => {
    const text = `${selectedPosition.latitude.toFixed(
      6
    )},${selectedPosition.longitude.toFixed(6)}`;
    navigator.clipboard
      ?.writeText(text)
      .then(() => console.log("Copied", text));
  };

  const startControlSending = () => {
    if (!controlIntervalId.current && isConnected && socket) {
      controlIntervalId.current = setInterval(() => {
        const data = {
          id: targetBoatId,
          md: commandModeValue,
          r: rudderRef.current,
          p: propellerRef.current,
        };
        socket.emit("gui_data", data);
      }, intervalTime);
    }
  };

  const stopControlSending = () => {
    if (controlIntervalId.current) {
      clearInterval(controlIntervalId.current);
      controlIntervalId.current = null;
    }
  };

  const handleRudderMove = (event) => {
    const newRudder = Math.round(event.x * 90);
    setRudder(newRudder);
    rudderRef.current = newRudder;
    startControlSending();
  };

  const handleRudderStop = () => {
    setRudder(0);
    rudderRef.current = 0;
    stopControlSending();
    if (socket && isConnected) {
      socket.emit("gui_data", {
        id: targetBoatId,
        md: commandModeValue,
        r: 0,
        p: propellerRef.current,
      });
    }
  };

  const handlePropellerChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setPropeller(val);
    propellerRef.current = val;
    startControlSending();
  };

  const handlePropellerMouseUp = () => {
    stopControlSending();
  };

  const toggleBoatDropdown = () => {
    setBoatDropdownOpen(!boatDropdownOpen);
  };

  return (
    <div className="autonomous-control-container">
      {notification && (
        <div className="notification-popup">
          <p>{notification.message}</p>
        </div>
      )}
      <div className="left-panel">
        <MapContainer
          center={mapCenter}
          zoom={14}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <ClickableMap />
          {boats.map((b) => {
            if (
              b.data &&
              typeof b.data.latitude === "number" &&
              typeof b.data.longitude === "number"
            ) {
              const isSelected = b.boat_id === targetBoatId;
              const icon = isSelected ? selectedBoatIcon : boatIcon;
              return (
                <Marker
                  key={b.boat_id}
                  position={[
                    parseFloat(b.data.latitude.toFixed(6)),
                    parseFloat(b.data.longitude.toFixed(6)),
                  ]}
                  icon={icon}
                  eventHandlers={{ click: () => setTargetBoatId(b.boat_id) }}
                >
                  <Popup>
                    <div>
                      <strong>{b.boat_id}</strong>
                      <br />
                      Latitude: {b.data.latitude.toFixed(6)}
                      <br />
                      Longitude: {b.data.longitude.toFixed(6)}
                    </div>
                  </Popup>
                </Marker>
              );
            }
            return null;
          })}
          {Object.keys(boatTrails).map((boatId) => (
            <Polyline
              key={boatId}
              positions={boatTrails[boatId]}
              pathOptions={{ color: getBoatColor(boatId) }}
            />
          ))}
          {selectedPosition && (
            <Marker
              position={[selectedPosition.latitude, selectedPosition.longitude]}
              icon={selectedIcon}
            >
              <Popup>
                Navigation:
                <br />
                Boat: {targetBoatId || "No Available Boats"}
                <br />
                Latitude: {selectedPosition.latitude.toFixed(6)}
                <br />
                Longitude: {selectedPosition.longitude.toFixed(6)}
                <br />
                <button onClick={copySelectedPosition}>Copy</button>
                <button
                  onClick={sendRouteToCurrentBoat}
                  disabled={!isConnected || !targetBoatId}
                >
                  Send Route
                </button>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      <div className="right-panel">
        <h2>Boats</h2>
        <div className="boat-dropdown">
          <div className="dropdown-header" onClick={toggleBoatDropdown}>
            {boatDropdownOpen
              ? "Select Boat:"
              : `Connected Boats: ${boats.length}`}
          </div>
          {boatDropdownOpen && (
            <ul className="dropdown-list">
              {boats.map((b) => (
                <li
                  key={b.boat_id}
                  onClick={() => {
                    setTargetBoatId(b.boat_id);
                    setBoatDropdownOpen(false);
                  }}
                >
                  {b.boat_id}
                </li>
              ))}
            </ul>
          )}
        </div>
        <h2>Control</h2>
        <div className="control-group">
          <h3>Rudder</h3>
          <Joystick
            size={100}
            baseColor="#ccc"
            stickColor="#555"
            move={handleRudderMove}
            stop={handleRudderStop}
            disabled={!isConnected}
          />
          <p>Rudder: {rudder}°</p>
        </div>
        <div className="control-group">
          <h3>Propeller</h3>
          <input
            type="range"
            min="0"
            max="100"
            value={propeller}
            onChange={handlePropellerChange}
            onMouseUp={handlePropellerMouseUp}
            onTouchEnd={handlePropellerMouseUp}
            className="vertical-slider"
            style={{ writingMode: "bt-lr" }}
          />
          <p>Propeller: {propeller}%</p>
        </div>
        {selectedPosition && (
          <div className="map-coordinates">
            <p>
              Lat: {selectedPosition.latitude.toFixed(6)}
              <br />
              Lng: {selectedPosition.longitude.toFixed(6)}
            </p>
            <button onClick={copySelectedPosition}>Copy</button>
            <button onClick={sendRouteToCurrentBoat}>Send Route</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AutonomousControl;
