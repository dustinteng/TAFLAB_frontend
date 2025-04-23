import React from "react";

/**
 * BoatDropdown Component
 * Props:
 * - boats: Array of { boat_id }
 * - targetBoatId: String
 * - setTargetBoatId: Function
 * - getBoatColor: Function(boatId) => String
 */
export default function BoatDropdown({
  boats,
  targetBoatId,
  setTargetBoatId,
  getBoatColor,
}) {
  return (
    <>
      <h3>Boats</h3>
      <div className="boat-dropdown-select">
        <select
          value={targetBoatId || ""}
          onChange={(e) => setTargetBoatId(e.target.value)}
          size={5} // enables scrollable dropdown
        >
          {boats.map((b) => (
            <option
              key={b.boat_id}
              value={b.boat_id}
              style={{ color: getBoatColor(b.boat_id), fontWeight: "bold" }}
            >
              {b.boat_id}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
