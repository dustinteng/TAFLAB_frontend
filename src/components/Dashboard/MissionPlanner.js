import React from "react";

/**
 * MissionPlanner Component
 * Props:
 * - waypointQueue: Array of { latitude, longitude }
 * - currentProgress: Number (0-100)
 * - mode: 'auto' | 'paused'
 * - toggleMission: Function to toggle between auto/paused
 * - setWaypointQueue: Function to update the waypoint queue
 */
export default function MissionPlanner({
  waypointQueue,
  currentProgress,
  mode,
  toggleMission,
  setWaypointQueue,
}) {
  return (
    <div className="mission-planner">
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
    </div>
  );
}
