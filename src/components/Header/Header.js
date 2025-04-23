// components/Header/Header.js

import React, { useState, useEffect } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useSocket } from "../../contexts/SocketContext";
import { useContext } from "react";
import { BoatContext } from "../../contexts/BoatContext";

import sunIcon from "./sun.png";
import moonIcon from "./moon.png";
import "./Header.css";

function Header({ toggleSidebar }) {
  const { theme, toggleTheme } = useTheme();
  const {
    selectedServer,
    setSelectedServer,
    isConnected,
    connect,
    disconnect,
  } = useSocket();

  const [servers, setServers] = useState([]);
  const [showBanner, setShowBanner] = useState(false);
  const { setBoats } = useContext(BoatContext);

  useEffect(() => {
    fetch("/Initialization/servers.json")
      .then((response) => response.json())
      .then((data) => {
        setServers(data);
        if (!selectedServer && data.length > 0) {
          setSelectedServer(data[0].value);
        }
      })
      .catch((error) => console.error("Error fetching server list:", error));
  }, [selectedServer, setSelectedServer]);

  const handleConnection = async () => {
    if (isConnected) {
      disconnect();
      setBoats([]); // ✅ Clear boats when disconnected
      setShowBanner(false);
    } else {
      try {
        await connect(selectedServer);
        setTimeout(() => {
          if (!isConnected) {
            setShowBanner(true);
            setTimeout(() => setShowBanner(false), 2000);
          }
        }, 500);
      } catch (error) {
        console.error("Connection attempt failed:", error);
        setShowBanner(true);
        setTimeout(() => setShowBanner(false), 2000);
      }
    }
  };

  const handleServerChange = (event) => {
    setSelectedServer(event.target.value);
    disconnect();
    setShowBanner(false);
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <h1>TAFLAB</h1>
        </div>

        <div className="connection-center">
          <select value={selectedServer} onChange={handleServerChange}>
            {servers.map((server) => (
              <option key={server.value} value={server.value}>
                {server.label}
              </option>
            ))}
          </select>
          <button onClick={handleConnection}>
            {isConnected ? "Disconnect" : "Connect"}
          </button>
          <div className="connection-status">
            <div
              className={`connection-light ${isConnected ? "green" : "gray"}`}
            ></div>
            <span className="connection-text">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        <div className="right-controls">
          <div className="theme-toggle">
            <img
              src={theme === "dark" ? moonIcon : sunIcon}
              alt={theme === "dark" ? "Dark Mode" : "Light Mode"}
              className="theme-icon"
            />
            <label className="theme-switch">
              <input
                type="checkbox"
                checked={theme === "dark"}
                onChange={toggleTheme}
              />
              <span className="slider"></span>
            </label>
          </div>
          <button className="hamburger" onClick={toggleSidebar}>
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
