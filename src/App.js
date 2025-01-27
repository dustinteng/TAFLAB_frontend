// App.js

import React, { useState } from "react";
import Header from "./components/Header/Header";
import Sidebar from "./components/Sidebar/Sidebar";
import AutonomousControl from "./components/Map/AutonomousControl";
import ManualControl from "./components/Map/ManualControl";
import DataTransfer from "./components/DataTransfer/DataTransfer";
import HeatmapWindow from "./components/Map/HeatmapWindow";
import Dashboard from "./components/Dashboard/Dashboard";
import "./styles/styles.css";

function App() {
  const [activeTab, setActiveTab] = useState("autonomous");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const renderTab = () => {
    switch (activeTab) {
      case "manual":
        return <ManualControl />;
      case "autonomous":
        return <AutonomousControl />;
      case "data":
        return <DataTransfer />;
      case "heatmap":
        return <HeatmapWindow />;
      case "dashboard":
        return <Dashboard />;
      default:
        return <ManualControl />;
    }
  };

  return (
    <div className="app-container">
      <Header toggleSidebar={toggleSidebar} />
      <div className="main-content">
        <Sidebar isSidebarOpen={isSidebarOpen} />
        <main className="control-panel">
          <nav className="tabs">
            <button
              className={activeTab === "manual" ? "active" : ""}
              onClick={() => setActiveTab("manual")}
            >
              Manual Control
            </button>
            <button
              className={activeTab === "autonomous" ? "active" : ""}
              onClick={() => setActiveTab("autonomous")}
            >
              Autonomous Control
            </button>
            <button
              className={activeTab === "data" ? "active" : ""}
              onClick={() => setActiveTab("data")}
            >
              Data Transfer
            </button>
            <button
              className={activeTab === "heatmap" ? "active" : ""}
              onClick={() => setActiveTab("heatmap")}
            >
              Heatmap
            </button>
            <button
              className={activeTab === "dashboard" ? "active" : ""}
              onClick={() => setActiveTab("dashboard")}
            >
              Dashboard
            </button>
          </nav>
          <section className="tab-content">{renderTab()}</section>
        </main>
      </div>
    </div>
  );
}

export default App;
