import React, { useContext, useState, useEffect } from "react";
import { BoatContext } from "../../contexts/BoatContext";
import "./Dashboard.css";

const Dashboard = () => {
  const { boats } = useContext(BoatContext); // Access boat data from context
  const [data, setData] = useState([]); // State to store boats with timestamps
  const [originalData, setOriginalData] = useState([]); // To store unfiltered data
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [searchCategory, setSearchCategory] = useState("boat_id");
  const [searchValue, setSearchValue] = useState("");
  const [showConfirm, setShowConfirm] = useState(false); // For reset confirmation

  // Load initial data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("boatData");
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      setData(parsedData);
      setOriginalData(parsedData);
    }
  }, []);

  // Save data to localStorage on data change
  useEffect(() => {
    localStorage.setItem("boatData", JSON.stringify(data));
  }, [data]);

  // Append new boat data with timestamps
  useEffect(() => {
    console.log("Incoming boats data:", boats); // Debugging: Log incoming boats data

    const newBoats = boats.map((boat) => {
      const boatData = boat.data || {}; // Access nested data object
      return {
        boat_id: boat.boat_id || "Unknown ID",
        chaos: boatData.chaos ?? "Unknown",
        status: boatData.status ?? "Unknown",
        temperature: boatData.temperature ?? "Unknown",
        wind_dir_u: boatData.wind_dir_u ?? "Unknown",
        wind_dir_v: boatData.wind_dir_v ?? "Unknown",
        timestamp: new Date().toISOString(),
      };
    });

    setData((prevData) => {
      const updatedData = [...prevData, ...newBoats];
      setOriginalData(updatedData);
      return updatedData;
    });
  }, [boats]);

  const sortData = (key) => {
    if (!key) return;

    const direction =
      sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";

    const sortedData = [...data].sort((a, b) => {
      if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
      return 0;
    });

    setSortConfig({ key, direction });
    setData(sortedData);
  };

  const handleSearch = () => {
    if (!searchValue.trim()) {
      setData(originalData); // Restore original data if search is cleared
      return;
    }

    const filteredData = originalData.filter((item) =>
      item[searchCategory]?.toString().toLowerCase().includes(searchValue.toLowerCase())
    );
    setData(filteredData);
  };

  const handleReset = () => {
    localStorage.removeItem("boatData");
    setData([]);
    setOriginalData([]);
    setShowConfirm(false);
  };

  return (
    <div className="dashboard">
      <h1>Data Table</h1>

      <div className="search-bar">
        <select
          value={searchCategory}
          onChange={(e) => setSearchCategory(e.target.value)}
        >
          <option value="boat_id">Boat ID</option>
          <option value="chaos">Chaos</option>
          <option value="status">Status</option>
          <option value="temperature">Temperature</option>
          <option value="wind_dir_u">Wind U</option>
          <option value="wind_dir_v">Wind V</option>
          <option value="timestamp">Timestamp</option>
        </select>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search..."
        />
        <button onClick={handleSearch}>Search</button>
        <button onClick={() => setShowConfirm(true)}>Reset</button>
      </div>

      {showConfirm && (
        <div className="confirm-reset">
          <p>Are you sure you want to reset all data?</p>
          <button onClick={handleReset}>Yes</button>
          <button onClick={() => setShowConfirm(false)}>No</button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th onClick={() => sortData("boat_id")}>Boat ID</th>
            <th onClick={() => sortData("chaos")}>Chaos</th>
            <th onClick={() => sortData("status")}>Status</th>
            <th onClick={() => sortData("temperature")}>Temperature</th>
            <th onClick={() => sortData("wind_dir_u")}>Wind U</th>
            <th onClick={() => sortData("wind_dir_v")}>Wind V</th>
            <th onClick={() => sortData("timestamp")}>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {data.map((boat, index) => (
            <tr key={index}>
              <td>{boat.boat_id}</td>
              <td>{boat.chaos}</td>
              <td>{boat.status}</td>
              <td>{boat.temperature}</td>
              <td>{boat.wind_dir_u}</td>
              <td>{boat.wind_dir_v}</td>
              <td>{boat.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Dashboard;
