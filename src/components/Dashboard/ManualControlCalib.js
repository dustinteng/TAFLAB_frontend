import React, { useState, useEffect, useContext, useRef } from "react";
import { Joystick } from "react-joystick-component";
import "./ManualControl.css";
import { useSocket } from "../../contexts/SocketContext";
import { BoatContext } from "../../contexts/BoatContext";

function ManualControl() {
  const { socket, isConnected, setCommandMode } = useSocket();
  const { boats } = useContext(BoatContext);

  const [selectedBoatId, setSelectedBoatId] = useState("");
  const [rudderAngle, setRudderAngle] = useState(0);
  const [throttleValue, setThrottleValue] = useState(0);

  const [isCalibrationMode, setIsCalibrationMode] = useState(false);
  const [calibrationValues, setCalibrationValues] = useState({
    rudderMin: "",
    rudderMax: "",
    throttleMin: "",
    throttleMax: "",
    sailMin: "",
    sailMax: "",
  });
  const [currentValues, setCurrentValues] = useState(calibrationValues); // Current values displayed on the left
  const [calibrationError, setCalibrationError] = useState(null);

  const rudderAngleRef = useRef(rudderAngle);
  const throttleValueRef = useRef(throttleValue);
  const intervalId = useRef(null);
  const commandMode = "mnl";
  const intervalTime = "500"; // 2Hz interval

  useEffect(() => {
    if (!selectedBoatId && boats.length > 0) {
      setSelectedBoatId(boats[0].boat_id);
    }
  }, [boats, selectedBoatId]);

  useEffect(() => {
    if (setCommandMode) {
      setCommandMode("mnl");
    }
  }, [setCommandMode]);

  const startSendingData = () => {
    if (!intervalId.current && isConnected && socket) {
      intervalId.current = setInterval(() => {
        const data = {
          id: selectedBoatId,
          md: commandMode,
          r: rudderAngleRef.current,
          th: throttleValueRef.current,
        };
        socket.emit("gui_data", data);
        console.log("Sent latest data:", data);
      }, intervalTime);
    }
  };

  const stopSendingData = () => {
    if (intervalId.current) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
  };

  const handleJoystickMove = (event) => {
    const newRudderAngle = Math.round(event.x * 90);
    const newThrottleValue = Math.round(event.y * 100);

    setRudderAngle(newRudderAngle);
    setThrottleValue(newThrottleValue);

    rudderAngleRef.current = newRudderAngle;
    throttleValueRef.current = newThrottleValue;

    startSendingData();
  };

  const handleJoystickStop = () => {
    setRudderAngle(0);
    setThrottleValue(0);
    rudderAngleRef.current = 0;
    throttleValueRef.current = 0;
    stopSendingData();

    if (socket && isConnected) {
      const zeroData = {
        id: selectedBoatId,
        md: commandMode,
        r: 0,
        th: 0,
        s: 0,
      };
      socket.emit("gui_data", zeroData);
      console.log(
        "Sent stop command with 0 values for all actuators:",
        zeroData
      );
    }
  };

  const handleSaveCalibration = () => {
    if (socket && isConnected) {
      const calibrationData = {
        ...calibrationValues,
        id: selectedBoatId,
      };
      socket.emit("calibration_data", calibrationData);
      console.log("Calibration data sent:", calibrationData);
    }
    setIsCalibrationMode(false);
  };

  const handleCalibrationChange = (e) => {
    const { name, value } = e.target;
    setCalibrationValues({
      ...calibrationValues,
      [name]: parseInt(value, 10),
    });
  };

  const testCalibrationValue = (type, value) => {
    if (socket && isConnected) {
      const testData = {
        id: selectedBoatId,
        type,
        value,
      };
      socket.emit("test_calibration", testData);
      console.log(`Testing ${type} with value:`, value);
    }
  };

  const fetchCalibrationData = () => {
    if (socket && isConnected && selectedBoatId) {
      setCalibrationError(null); // Clear any previous error
      setCalibrationValues({
        rudderMin: "",
        rudderMax: "",
        throttleMin: "",
        throttleMax: "",
        sailMin: "",
        sailMax: "",
      });
      socket.emit("request_calibration_data", { id: selectedBoatId });
      console.log("Requested calibration data for boat:", selectedBoatId);
    } else {
      setCalibrationError("No boat connected or selected.");
    }
  };

  useEffect(() => {
    if (socket) {
      socket.on("calibration_data_response", (response) => {
        if (response.id === selectedBoatId) {
          if (response.data) {
            setCalibrationValues({
              rudderMin: response.data.rudder_min,
              rudderMax: response.data.rudder_max,
              throttleMin: response.data.esc_min,
              throttleMax: response.data.esc_max,
              sailMin: response.data.sail_min,
              sailMax: response.data.sail_max,
            });
            setCurrentValues({
              rudderMin: response.data.rudder_min,
              rudderMax: response.data.rudder_max,
              throttleMin: response.data.esc_min,
              throttleMax: response.data.esc_max,
              sailMin: response.data.sail_min,
              sailMax: response.data.sail_max,
            });
            setCalibrationError(null); // Clear any previous error
          } else if (response.error) {
            setCalibrationError(response.error);
          }
        }
      });
    }
    return () => {
      if (socket) {
        socket.off("calibration_data_response");
      }
    };
  }, [socket, selectedBoatId]);

  useEffect(() => {
    return () => stopSendingData(); // Cleanup interval on unmount
  }, []);

  const openCalibrationModal = () => {
    setIsCalibrationMode(true);
    fetchCalibrationData(); // Fetch data each time modal opens
  };

  const closeModal = () => {
    setIsCalibrationMode(false);
    setCalibrationValues({
      rudderMin: "",
      rudderMax: "",
      throttleMin: "",
      throttleMax: "",
      sailMin: "",
      sailMax: "",
    });
    setCalibrationError(null); // Clear any previous error
  };

  return (
    <div className="manual-control-container">
      <header className="control-header">
        <h2>Manual Control</h2>
        <div className="boat-selection">
          <label>Select Boat:</label>
          <select
            value={selectedBoatId}
            onChange={(e) => setSelectedBoatId(e.target.value)}
          >
            {boats.length > 0 ? (
              boats.map((boat) => (
                <option key={boat.boat_id} value={boat.boat_id}>
                  {boat.boat_id}
                </option>
              ))
            ) : (
              <option>No boats available</option>
            )}
          </select>
        </div>
        <button onClick={openCalibrationModal}>Calibration Settings</button>
      </header>

      {isCalibrationMode && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="calibration-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-modal" onClick={closeModal}>
              X
            </button>
            <h3>Calibration Settings</h3>
            {calibrationError ? (
              <p>{calibrationError}</p>
            ) : (
              <div className="calibration-columns">
                <div className="current-values">
                  <h4>Current Values</h4>
                  <p>Rudder Min: {currentValues.rudderMin}</p>
                  <p>Rudder Max: {currentValues.rudderMax}</p>
                  <p>Throttle Min: {currentValues.throttleMin}</p>
                  <p>Throttle Max: {currentValues.throttleMax}</p>
                  <p>Sail Min: {currentValues.sailMin}</p>
                  <p>Sail Max: {currentValues.sailMax}</p>
                </div>
                <div className="calibration-inputs">
                  <h4>Calibration</h4>
                  <div>
                    <label>Rudder Min:</label>
                    <input
                      type="number"
                      name="rudderMin"
                      value={calibrationValues.rudderMin}
                      onChange={handleCalibrationChange}
                    />
                    <button
                      onClick={() =>
                        testCalibrationValue(
                          "rudder",
                          calibrationValues.rudderMin
                        )
                      }
                    >
                      Test
                    </button>
                  </div>
                  <div>
                    <label>Rudder Max:</label>
                    <input
                      type="number"
                      name="rudderMax"
                      value={calibrationValues.rudderMax}
                      onChange={handleCalibrationChange}
                    />
                    <button
                      onClick={() =>
                        testCalibrationValue(
                          "rudder",
                          calibrationValues.rudderMax
                        )
                      }
                    >
                      Test
                    </button>
                  </div>
                  <div>
                    <label>Throttle Min:</label>
                    <input
                      type="number"
                      name="throttleMin"
                      value={calibrationValues.throttleMin}
                      onChange={handleCalibrationChange}
                    />
                    <button
                      onClick={() =>
                        testCalibrationValue(
                          "throttle",
                          calibrationValues.throttleMin
                        )
                      }
                    >
                      Test
                    </button>
                  </div>
                  <div>
                    <label>Throttle Max:</label>
                    <input
                      type="number"
                      name="throttleMax"
                      value={calibrationValues.throttleMax}
                      onChange={handleCalibrationChange}
                    />
                    <button
                      onClick={() =>
                        testCalibrationValue(
                          "throttle",
                          calibrationValues.throttleMax
                        )
                      }
                    >
                      Test
                    </button>
                  </div>
                  <div>
                    <label>Sail Min:</label>
                    <input
                      type="number"
                      name="sailMin"
                      value={calibrationValues.sailMin}
                      onChange={handleCalibrationChange}
                    />
                    <button
                      onClick={() =>
                        testCalibrationValue("sail", calibrationValues.sailMin)
                      }
                    >
                      Test
                    </button>
                  </div>
                  <div>
                    <label>Sail Max:</label>
                    <input
                      type="number"
                      name="sailMax"
                      value={calibrationValues.sailMax}
                      onChange={handleCalibrationChange}
                    />
                    <button
                      onClick={() =>
                        testCalibrationValue("sail", calibrationValues.sailMax)
                      }
                    >
                      Test
                    </button>
                  </div>
                </div>
              </div>
            )}
            <button onClick={handleSaveCalibration}>Save Calibration</button>
          </div>
        </div>
      )}

      <div className="controls-section">
        <div className="joystick-container">
          <Joystick
            size={150}
            baseColor="#ccc"
            stickColor="#555"
            move={handleJoystickMove}
            stop={handleJoystickStop}
            disabled={!isConnected}
          />
          <div className="joystick-values">
            <p>Rudder Angle: {rudderAngle}°</p>
            <p>Throttle: {throttleValue}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManualControl;
