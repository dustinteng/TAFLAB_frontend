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
import "./ControlDashboard.css";

const boatColors = {};
const getBoatColor = (boatId) => {
  if (!boatColors[boatId]) {
    boatColors[boatId] =
      "#" + ((Math.random() * 0xffffff) << 0).toString(16).padStart(6, "0");
  }
  return boatColors[boatId];
};

function ControlDashboard() {
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
          message: "${b.boat_id} has reached its destination.",
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
    }
  };

  const startControlSending = () => {
    if (!controlIntervalId.current && isConnected && socket) {
      controlIntervalId.current = setInterval(() => {
        socket.emit("gui_data", {
          id: targetBoatId,
          md: commandModeValue,
          r: rudderRef.current,
          p: propellerRef.current,
        });
      }, 500);
    }
  };

  const stopControlSending = () => {
    if (controlIntervalId.current) {
      clearInterval(controlIntervalId.current);
      controlIntervalId.current = null;
    }
  };

  const handleRudderMove = (e) => {
    const r = Math.round(e.x * 90);
    setRudder(r);
    rudderRef.current = r;
    startControlSending();
  };

  const handleRudderStop = () => {
    setRudder(0);
    rudderRef.current = 0;
    stopControlSending();
    socket.emit("gui_data", {
      id: targetBoatId,
      md: commandModeValue,
      r: 0,
      p: propellerRef.current,
    });
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
              return (
                <Marker
                  key={b.boat_id}
                  position={[b.data.latitude, b.data.longitude]}
                  icon={
                    b.boat_id === targetBoatId
                      ? new L.DivIcon({
                          className: "custom-icon",
                          html: (
                            <div
                              style="width:16px;height:16px;border-radius:50%;background:${getBoatColor(
                            b.boat_id
                          )};border:2px solid black"
                            ></div>
                          ),
                        })
                      : new L.DivIcon({
                          className: "custom-icon",
                          html: (
                            <div
                              style="width:12px;height:12px;border-radius:50%;background:${getBoatColor(
                            b.boat_id
                          )}"
                            ></div>
                          ),
                        })
                  }
                  eventHandlers={{ click: () => setTargetBoatId(b.boat_id) }}
                >
                  <Popup>
                    <div>
                      <strong>{b.boat_id}</strong>
                      <br />
                      Latitude: {b.data.latitude.toFixed(6)}
                      <br />
                      Longitude: {b.data.longitude.toFixed(6)}
                      <br />
                      <button onClick={sendRouteToCurrentBoat}>
                        Send Route
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            }
            return null;
          })}
          {Object.keys(boatTrails).map((id) => (
            <Polyline
              key={id}
              positions={boatTrails[id]}
              pathOptions={{ color: getBoatColor(id) }}
            />
          ))}
          {selectedPosition && (
            <Marker
              position={[selectedPosition.latitude, selectedPosition.longitude]}
            >
              <Popup>
                Lat: {selectedPosition.latitude.toFixed(6)}
                <br />
                Lng: {selectedPosition.longitude.toFixed(6)}
                <br />
                <button onClick={sendRouteToCurrentBoat}>Send Route</button>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      <div className="right-panel">
        <h2>Boats</h2>
        <div
          className="boat-dropdown"
          style={{ maxHeight: "200px", overflowY: "auto" }}
        >
          {boats.map((b) => (
            <div
              key={b.boat_id}
              style={{
                backgroundColor:
                  b.boat_id === targetBoatId
                    ? getBoatColor(b.boat_id)
                    : "#f4f4f4",
                color: b.boat_id === targetBoatId ? "white" : "black",
                padding: "6px 10px",
                cursor: "pointer",
              }}
              onClick={() => setTargetBoatId(b.boat_id)}
            >
              {b.boat_id}
            </div>
          ))}
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
      </div>
    </div>
  );
}
export default ControlDashboard;
