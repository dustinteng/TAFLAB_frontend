// App.js
import React, { useState } from "react";
import Header from "./components/Header/Header";
import Sidebar from "./components/Sidebar/Sidebar";
import ControlDashboard from "./components/Map/ControlDashboard";
import DataTransfer from "./components/DataTransfer/DataTransfer";
import HeatmapWindow from "./components/Map/HeatmapWindow";
import "./styles/styles.css";

function App() {
  const [activeTab, setActiveTab] = useState("autonomous");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const renderTab = () => {
    switch (activeTab) {
      case "manual":
        return <ControlDashboard />;
      case "data":
        return <DataTransfer />;
      case "heatmap":
        return <HeatmapWindow />;
      case "autonomous":
      default:
        return <ControlDashboard />;
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
              className={activeTab === "autonomous" ? "active" : ""}
              onClick={() => setActiveTab("autonomous")}
            >
              Main Dashboard
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
          </nav>
          <section className="tab-content">{renderTab()}</section>
        </main>
      </div>
    </div>
  );
}

export default App;
