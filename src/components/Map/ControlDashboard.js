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

  // modes: auto, mnl, paused
  const [mode, setMode] = useState("auto");
  useEffect(() => {
    setCommandMode?.(mode);
  }, [mode, setCommandMode]);

  const [targetBoatId, setTargetBoatId] = useState("");
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [waypointQueue, setWaypointQueue] = useState([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [boatTrails, setBoatTrails] = useState({});
  const [notification, setNotification] = useState(null);
  const [rudder, setRudder] = useState(0);
  const [propeller, setPropeller] = useState(0);
  const rudderRef = useRef(0);
  const propellerRef = useRef(0);
  const intervalRef = useRef(null);
  const mapRef = useRef(null);

  // initialize selected boat
  useEffect(() => {
    if (!targetBoatId && boats.length) setTargetBoatId(boats[0].boat_id);
  }, [boats, targetBoatId]);

  // update trails
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

  // notifications
  useEffect(() => {
    boats.forEach((b) => {
      if (b.data?.notification?.type === "reached")
        setNotification(`${b.boat_id} reached its destination.`);
    });
  }, [boats]);
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 2000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // map click for auto route selection
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

  // send auto route
  const sendRoute = () => {
    if (socket && isConnected && targetBoatId && selectedPosition) {
      socket.emit("gui_data", {
        id: targetBoatId,
        md: "auto",
        tlat: selectedPosition.latitude,
        tlng: selectedPosition.longitude,
      });
      setSelectedPosition(null);
    }
  };

  // manual control send helper
  const startSending = () => {
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
  const stopSending = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const onRudderMove = (e) => {
    setMode("mnl");
    const r = Math.round(e.x * 90);
    setRudder(r);
    rudderRef.current = r;
    startSending();
  };
  const onRudderStop = () => {
    setRudder(0);
    rudderRef.current = 0;
    stopSending();
    socket.emit("gui_data", {
      id: targetBoatId,
      md: "mnl",
      r: 0,
      th: propellerRef.current,
    });
  };

  const onPropChange = (e) => {
    setMode("mnl");
    const v = +e.target.value;
    setPropeller(v);
    propellerRef.current = v;
    startSending();
  };
  const onPropEnd = () => {
    stopSending();
    socket.emit("gui_data", {
      id: targetBoatId,
      md: "mnl",
      r: rudderRef.current,
      th: propellerRef.current,
    });
  };

  // waypoint queue and mission controls
  const addWaypoint = () => {
    if (selectedPosition) setWaypointQueue((q) => [...q, selectedPosition]);
  };
  // skip current waypoint and dispatch next
  const skipWaypoint = () => {
    setWaypointQueue((q) => {
      const newQueue = q.slice(1);
      if (mode === "auto" && newQueue.length) {
        const wp = newQueue[0];
        socket.emit("gui_data", {
          id: targetBoatId,
          md: "auto",
          tlat: wp.latitude,
          tlng: wp.longitude,
        });
      }
      return newQueue;
    });
  };
  // pause/continue mission and on continue, send next waypoint
  const toggleMission = () => {
    setMode((prev) => {
      const next = prev === "auto" ? "paused" : "auto";
      if (next === "auto" && waypointQueue.length > 0) {
        const wp = waypointQueue[0];
        socket.emit("gui_data", {
          id: targetBoatId,
          md: "auto",
          tlat: wp.latitude,
          tlng: wp.longitude,
        });
      }
      return next;
    });
  };

  // compute progress to next waypoint
  useEffect(() => {
    if (waypointQueue.length && boats.length) {
      const b = boats.find((b) => b.boat_id === targetBoatId);
      if (b?.data) {
        const [lat, lng] = [
          waypointQueue[0].latitude,
          waypointQueue[0].longitude,
        ];
        const total = getDistance(b.data.latitude, b.data.longitude, lat, lng);
        const traveled = 0; // stub for actual traveled
        setCurrentProgress(total ? Math.min(100, (traveled / total) * 100) : 0);
      }
    }
  }, [waypointQueue, boats, targetBoatId]);

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // recenter map
  const recenterMap = (id) => {
    const b = boats.find((b) => b.boat_id === (id || targetBoatId));
    if (
      b?.data?.latitude != null &&
      b.data.longitude != null &&
      mapRef.current
    ) {
      mapRef.current.setView(
        [b.data.latitude, b.data.longitude],
        mapRef.current.getZoom()
      );
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
            center={[37.866942, -122.315452]}
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
                      }px; height:${
                        b.boat_id === targetBoatId ? 18 : 12
                      }px; border-radius:50%; background:${getBoatColor(
                        b.boat_id
                      )}; border:${
                        b.boat_id === targetBoatId ? "2px solid black" : ""
                      };"></div>`,
                    })
                  }
                  eventHandlers={{
                    click: () => {
                      setTargetBoatId(b.boat_id);
                      recenterMap(b.boat_id);
                    },
                  }}
                >
                  <Popup>
                    <div style={{ textAlign: "center" }}>
                      <strong>{b.boat_id}</strong>
                      <p>Status: {b.data.status}</p>
                      <button onClick={() => recenterMap(b.boat_id)}>
                        Center
                      </button>
                      <button onClick={toggleMission}>
                        {mode === "auto" ? "Pause Mission" : "Continue Mission"}
                      </button>
                      <button
                        onClick={skipWaypoint}
                        disabled={!waypointQueue.length}
                      >
                        Skip Waypoint
                      </button>
                    </div>
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
                  <br /> Lng: {selectedPosition.longitude.toFixed(6)}
                  <br />
                  <button onClick={addWaypoint}>Queue this Waypoint</button>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
        <div className="right-panel">
          <h3>Mission Planner</h3>
          <div>
            Next Target:{" "}
            {waypointQueue[0]
              ? `${waypointQueue[0].latitude}, ${waypointQueue[0].longitude}`
              : "None"}
          </div>
          <div>Status: {mode}</div>
          <div>Progress: {currentProgress.toFixed(1)}%</div>
          <button onClick={toggleMission} style={{ marginBottom: "8px" }}>
            {mode === "auto" ? "Pause Mission" : "Continue Mission"}
          </button>
          <ul>
            {waypointQueue.map((wp, i) => (
              <li key={i} style={{ marginBottom: "4px" }}>
                {wp.latitude}, {wp.longitude}{" "}
                <button
                  onClick={() =>
                    setWaypointQueue((q) => q.filter((_, j) => j !== i))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <h3>Controls</h3>
          <button onClick={() => recenterMap()} style={{ margin: "10px 0" }}>
            📍 Recenter
          </button>
          <div className={`control-group ${mode !== "mnl" ? "hidden" : ""}`}>
            <h4>Rudder</h4>
            <Joystick
              size={100}
              baseColor="#ccc"
              stickColor="#555"
              move={onRudderMove}
              stop={onRudderStop}
              disabled={!isConnected}
            />
            <p>{rudder}°</p>
            <h4>Propeller</h4>
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
