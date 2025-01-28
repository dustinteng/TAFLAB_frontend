import React, { useState, useEffect, useContext } from "react";
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
import { useSocket } from "../../contexts/SocketContext";
import { BoatContext } from "../../contexts/BoatContext";
import "./AutonomousControl.css";

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
  const [copiedPosition, setCopiedPosition] = useState(null);
  const [mapCenter, setMapCenter] = useState([37.866942, -122.315452]);
  const [boatTargets, setBoatTargets] = useState({});
  const [boatTrails, setBoatTrails] = useState({});
  const [boatStatuses, setBoatStatuses] = useState({});
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (setCommandMode) {
      setCommandMode("autonomous");
    }
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
    const newBoatStatuses = { ...boatStatuses };

    boats.forEach((b) => {
      if (
        b.data &&
        typeof b.data.latitude === "number" &&
        typeof b.data.longitude === "number"
      ) {
        if (!newBoatTrails[b.boat_id]) {
          newBoatTrails[b.boat_id] = [];
        }
        newBoatTrails[b.boat_id].push([b.data.latitude, b.data.longitude]);
        if (newBoatTrails[b.boat_id].length > 50) {
          newBoatTrails[b.boat_id].shift();
        }

        if (b.data.status) {
          newBoatStatuses[b.boat_id] = b.data.status;
        }
      }
    });

    setBoatTrails(newBoatTrails);
    setBoatStatuses(newBoatStatuses);
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
      const timer = setTimeout(() => {
        setNotification(null);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleBoatChange = (event) => {
    setTargetBoatId(event.target.value);
  };

  const handleMapClick = (e) => {
    const lat = parseFloat(e.latlng.lat.toFixed(6));
    const lng = parseFloat(e.latlng.lng.toFixed(6));
    setSelectedPosition({ latitude: lat, longitude: lng });
  };

  const copySelectedPosition = () => {
    const textToCopy = `${selectedPosition.latitude.toFixed(
      6
    )},${selectedPosition.longitude.toFixed(6)}`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          console.log("Copied to clipboard:", textToCopy);
          setCopiedPosition({ ...selectedPosition });
        })
        .catch((err) => {
          console.error("Could not copy text: ", err);
        });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
      setCopiedPosition({ ...selectedPosition });
      console.log("Copied to clipboard:", textToCopy);
    }
  };

  const sendRouteToCurrentBoat = () => {
    if (socket && isConnected && targetBoatId && selectedPosition) {
      const data = {
        id: targetBoatId,
        md: "auto",
        tlat: selectedPosition.latitude,
        tlng: selectedPosition.longitude,
      };
      socket.emit("gui_data", data);
      console.log("Sent route to current boat:", data);
    } else {
      console.warn(
        "Socket is not connected, no boat selected, or no position set."
      );
    }
  };

  const pasteCopiedPosition = (boatId) => {
    if (copiedPosition) {
      setBoatTargets((prev) => ({
        ...prev,
        [boatId]: {
          ...prev[boatId],
          latitude: parseFloat(copiedPosition.latitude.toFixed(6)),
          longitude: parseFloat(copiedPosition.longitude.toFixed(6)),
        },
      }));
    }
  };

  function ClickableMap() {
    useMapEvents({
      click: handleMapClick,
    });
    return null;
  }

  const handleBoatMarkerClick = (boatId) => {
    setTargetBoatId(boatId);
  };

  return (
    <div className="autonomous-control-container">
      <h2>Autonomous Control</h2>

      {notification && (
        <div className="notification-popup">
          <p>{notification.message}</p>
        </div>
      )}

      {!isConnected && <p className="warning-text">Not connected to server.</p>}

      <div className="boat-selection">
        <label>Select Boat: </label>
        <select value={targetBoatId} onChange={handleBoatChange}>
          {boats.map((b) => (
            <option key={b.boat_id} value={b.boat_id}>
              {b.boat_id}
            </option>
          ))}
        </select>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={14}
        style={{ width: "100%", height: "500px" }}
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
            const boatColor = getBoatColor(b.boat_id);

            return (
              <Marker
                key={b.boat_id}
                position={[
                  parseFloat(b.data.latitude.toFixed(6)),
                  parseFloat(b.data.longitude.toFixed(6)),
                ]}
                icon={icon}
                eventHandlers={{
                  click: () => handleBoatMarkerClick(b.boat_id),
                }}
              >
                <Popup>
                  <div>
                    <b>{b.boat_id}</b>
                    <br />
                    Latitude: {b.data.latitude.toFixed(6)}
                    <br />
                    Longitude: {b.data.longitude.toFixed(6)}
                    <hr />
                    <div>
                      <label>Target Latitude:</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={boatTargets[b.boat_id]?.latitude || ""}
                        onChange={(e) => {
                          const value = parseFloat(
                            parseFloat(e.target.value).toFixed(6)
                          );
                          setBoatTargets((prev) => ({
                            ...prev,
                            [b.boat_id]: {
                              ...prev[b.boat_id],
                              latitude: value,
                            },
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <label>Target Longitude:</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={boatTargets[b.boat_id]?.longitude || ""}
                        onChange={(e) => {
                          const value = parseFloat(
                            parseFloat(e.target.value).toFixed(6)
                          );
                          setBoatTargets((prev) => ({
                            ...prev,
                            [b.boat_id]: {
                              ...prev[b.boat_id],
                              longitude: value,
                            },
                          }));
                        }}
                      />
                    </div>
                    <button
                      onClick={() => pasteCopiedPosition(b.boat_id)}
                      disabled={!copiedPosition}
                    >
                      Paste
                    </button>
                    <button
                      onClick={sendRouteToCurrentBoat}
                      disabled={!isConnected}
                    >
                      Send Target Coordinates
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          } else {
            console.warn(`Boat ${b.boat_id} has no valid location data.`);
            return null;
          }
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
  );
}

export default AutonomousControl;
