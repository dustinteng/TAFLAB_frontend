// src/components/ControlDashboard/ControlDashboard.jsx
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

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import { Joystick } from "react-joystick-component";
import { useSocket } from "../../contexts/SocketContext";
import { BoatContext } from "../../contexts/BoatContext";
import "./ControlDashboard.css";

// override default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const targetIcon = new L.Icon({
  iconUrl: "/target-location.png",
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

function ControlDashboard() {
  const { socket, isConnected, setCommandMode } = useSocket();
  const { boats } = useContext(BoatContext);

  const [mode, setMode] = useState("auto");
  useEffect(() => {
    setCommandMode?.(mode);
  }, [mode, setCommandMode]);

  const [targetBoatId, setTargetBoatId] = useState("");
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [mapCenter, setMapCenter] = useState([37.866942, -122.315452]);
  const [boatTrails, setBoatTrails] = useState({});
  const [notification, setNotification] = useState(null);
  const [rudder, setRudder] = useState(0);
  const [propeller, setPropeller] = useState(0);
  const rudderRef = useRef(0);
  const propellerRef = useRef(0);
  const intervalRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!targetBoatId && boats.length) setTargetBoatId(boats[0].boat_id);
  }, [boats, targetBoatId]);

  useEffect(() => {
    setBoatTrails((prev) => {
      const trails = { ...prev };
      boats.forEach((b) => {
        if (b.data?.latitude != null && b.data?.longitude != null) {
          const arr = trails[b.boat_id] || [];
          trails[b.boat_id] = [
            ...arr,
            [b.data.latitude, b.data.longitude],
          ].slice(-50);
        }
      });
      return trails;
    });
  }, [boats]);

  useEffect(() => {
    const b = boats.find((b) => b.boat_id === targetBoatId);
    if (b?.data) setMapCenter([b.data.latitude, b.data.longitude]);
  }, [boats, targetBoatId]);

  useEffect(() => {
    boats.forEach((b) => {
      const n = b.data?.notification;
      if (n?.type === "reached")
        setNotification(`${b.boat_id} reached its destination.`);
    });
  }, [boats]);

  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 2000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const handleMapClick = (e) => {
    setSelectedPosition({
      latitude: +e.latlng.lat.toFixed(6),
      longitude: +e.latlng.lng.toFixed(6),
    });
  };

  function ClickableMap() {
    useMapEvents({ click: handleMapClick });
    return null;
  }

  const sendRoute = () => {
    if (socket && isConnected && targetBoatId && selectedPosition) {
      socket.emit("gui_data", {
        id: targetBoatId,
        md: "auto",
        tlat: selectedPosition.latitude,
        tlng: selectedPosition.longitude,
      });
    }
  };

  const startSending = () => {
    if (!intervalRef.current && socket && isConnected) {
      intervalRef.current = setInterval(() => {
        socket.emit("gui_data", {
          id: targetBoatId,
          md: mode,
          r: rudderRef.current,
          th: propellerRef.current,
        });
      }, 500);
    }
  };

  const stopSending = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const onRudderMove = (e) => {
    // switch to manual mode when joystick is used
    setMode("mnl");
    const r = Math.round(e.x * 90);
    setRudder(r);
    rudderRef.current = r;
    // emit manual command
    if (!intervalRef.current && socket && isConnected) {
      intervalRef.current = setInterval(() => {
        socket.emit("gui_data", {
          id: targetBoatId,
          md: "mnl",
          r: rudderRef.current,
          th: propellerRef.current,
        });
      }, 500);
    }
  };

  const onRudderStop = () => {
    setRudder(0);
    rudderRef.current = 0;
    stopSending();
    // send final manual reset
    socket.emit("gui_data", {
      id: targetBoatId,
      md: "mnl",
      r: 0,
      th: propellerRef.current,
    });
  };

  const onPropChange = (e) => {
    // switch to manual mode when slider is used
    setMode("mnl");
    const v = +e.target.value;
    setPropeller(v);
    propellerRef.current = v;
    // emit manual command
    if (!intervalRef.current && socket && isConnected) {
      intervalRef.current = setInterval(() => {
        socket.emit("gui_data", {
          id: targetBoatId,
          md: "mnl",
          r: rudderRef.current,
          th: propellerRef.current,
        });
      }, 500);
    }
  };

  const onPropEnd = () => {
    stopSending();
    // send final manual throttle
    if (socket && isConnected && targetBoatId) {
      socket.emit("gui_data", {
        id: targetBoatId,
        md: "mnl",
        r: rudderRef.current,
        th: propellerRef.current,
      });
    }
  };

  const recenterMap = () => {
    const boat = boats.find((b) => b.boat_id === targetBoatId);
    if (boat?.data?.latitude && boat?.data?.longitude && mapRef.current) {
      mapRef.current.setView([boat.data.latitude, boat.data.longitude], 14);
    }
  };

  return (
    <div className="control-dashboard">
      <div className="autonomous-control-container">
        {notification && (
          <div className="notification-popup">{notification}</div>
        )}
        <div className="left-panel">
          <MapContainer
            center={mapCenter}
            zoom={14}
            style={{ width: "100%", height: "100%" }}
            whenCreated={(map) => (mapRef.current = map)}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
            <ClickableMap />
            {boats.map((b) =>
              b.data ? (
                <Marker
                  key={b.boat_id}
                  position={[b.data.latitude, b.data.longitude]}
                  icon={
                    new L.DivIcon({
                      html: `<div style="width:${
                        b.boat_id === targetBoatId ? 18 : 12
                      }px;height:${
                        b.boat_id === targetBoatId ? 18 : 12
                      }px;border-radius:50%;background:${getBoatColor(
                        b.boat_id
                      )};border:${
                        b.boat_id === targetBoatId ? "2px solid black" : ""
                      };box-shadow:${
                        b.boat_id === targetBoatId ? "0 0 5px red" : "none"
                      };"></div>`,
                    })
                  }
                  eventHandlers={{ click: () => setTargetBoatId(b.boat_id) }}
                >
                  <Popup>
                    <strong>{b.boat_id}</strong>
                    <br /> Lat: {b.data.latitude.toFixed(6)}
                    <br /> Lng: {b.data.longitude.toFixed(6)}
                    <br />
                    <button onClick={sendRoute}>Send Route</button>
                  </Popup>
                </Marker>
              ) : null
            )}
            {Object.entries(boatTrails).map(([id, pts]) => (
              <Polyline
                key={id}
                positions={pts}
                pathOptions={{ color: getBoatColor(id) }}
              />
            ))}
            {selectedPosition && (
              <Marker
                position={[
                  selectedPosition.latitude,
                  selectedPosition.longitude,
                ]}
                icon={targetIcon}
              >
                <Popup>
                  Lat: {selectedPosition.latitude.toFixed(6)}
                  <br />
                  Lng: {selectedPosition.longitude.toFixed(6)}
                  <br />
                  <button onClick={sendRoute}>Send Route</button>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
        <div className="right-panel">
          <h2>Controls</h2>
          <button onClick={recenterMap} style={{ marginBottom: "10px" }}>
            📍
          </button>

          <div
            className="boat-dropdown"
            style={{ width: "100%", marginBottom: "10px" }}
          >
            {boats.map((b) => (
              <div
                key={b.boat_id}
                onClick={() => setTargetBoatId(b.boat_id)}
                style={{
                  padding: "6px",
                  cursor: "pointer",
                  backgroundColor:
                    b.boat_id === targetBoatId
                      ? getBoatColor(b.boat_id)
                      : "#f0f0f0",
                  color: b.boat_id === targetBoatId ? "#fff" : "#000",
                  borderRadius: "4px",
                  fontWeight: b.boat_id === targetBoatId ? "bold" : "normal",
                  textAlign: "center",
                  marginBottom: "4px",
                }}
              >
                {b.boat_id}
              </div>
            ))}
          </div>

          <div className={`control-group ${mode !== "mnl" ? "hidden" : ""}`}>
            <h3>Rudder</h3>
            <Joystick
              size={100}
              baseColor="#ccc"
              stickColor="#555"
              move={onRudderMove}
              stop={onRudderStop}
              disabled={!isConnected}
            />
            <p>{rudder}°</p>
          </div>
          <div className={`control-group ${mode !== "mnl" ? "hidden" : ""}`}>
            <h3>Propeller</h3>
            <input
              type="range"
              min="0"
              max="100"
              value={propeller}
              onChange={onPropChange}
              onMouseUp={onPropEnd}
              onTouchEnd={onPropEnd}
              className="vertical-slider"
            />
            <p>{propeller}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ControlDashboard;
