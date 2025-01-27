import React, { useContext, useState, useEffect } from "react";
import { BoatContext } from "../../contexts/BoatContext";
import "./Dashboard.css";

const Dashboard = () => {
  const { boats } = useContext(BoatContext); // Access boat data from context
  const [sortedBoats, setSortedBoats] = useState([]);
  const [sortOrder, setSortOrder] = useState("asc");

  // Effect to initialize sortedBoats
  useEffect(() => {
    setSortedBoats(boats);
  }, [boats]);

  // Sort boats by time
  const sortData = () => {
    const sorted = [...sortedBoats].sort((a, b) => {
      const timeA = new Date(a.timestamp);
      const timeB = new Date(b.timestamp);
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    setSortedBoats(sorted);
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <button onClick={sortData}>
        Sort by Time ({sortOrder === "asc" ? "Ascending" : "Descending"})
      </button>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {sortedBoats.map((boat) => (
            <tr key={boat.boat_id}>
              <td>{boat.boat_id}</td>
              <td>{boat.name}</td>
              <td>{new Date(boat.timestamp).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Dashboard;
