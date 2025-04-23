import React from "react";
import { Joystick } from "react-joystick-component";

/**
 * ManualControl Component
 * Props:
 * - mode: 'auto' | 'mnl' | 'paused'
 * - isConnected: Boolean
 * - rudder: Number (degrees)
 * - propeller: Number (0-100%)
 * - onRudderMove: Function(event)
 * - onRudderStop: Function()
 * - onPropChange: Function(event)
 * - onPropEnd: Function()
 * - recenterMap: Function()
 */
export default function ManualControl({
  mode,
  isConnected,
  rudder,
  propeller,
  onRudderMove,
  onRudderStop,
  onPropChange,
  onPropEnd,
  recenterMap,
}) {
  return (
    <>
      <h3>Controls</h3>
      <button onClick={recenterMap} style={{ margin: "10px 0" }}>
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
    </>
  );
}
