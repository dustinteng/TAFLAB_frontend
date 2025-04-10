// components/Map/HeatmapWindow.js
import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.heat";
import Papa from "papaparse";
import "./HeatmapWindow.css";

const HeatmapWindow = () => {
  const [dataType, setDataType] = useState("temperature");
  const [boatsData, setBoatsData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [filteredBoats, setFilteredBoats] = useState([]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [timeRange, setTimeRange] = useState({ min: null, max: null });
  const [csvFiles, setCsvFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [showBoatMarkers, setShowBoatMarkers] = useState(true);

  // Legend dragging states
  const legendRef = useRef(null);
  const [legendPosition, setLegendPosition] = useState({ x: null, y: null });
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const legendStartPos = useRef({ x: 0, y: 0 });

  // Custom boat icon
  const boatIcon = new L.Icon({
    iconUrl: "boat.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  // 1. Fetch source list
  useEffect(() => {
    console.log("Fetching sources from /sources...");
    fetch("http://127.0.0.1:5000/sources")
      .then((response) => {
        console.log("Received response. Status:", response.status);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("Response JSON:", data);
        const sources = data.sources || [];
        setCsvFiles(sources);
        if (sources.length > 0) {
          setSelectedFile(sources[0]);
        } else {
          console.warn("No sources available. Please upload a CSV file.");
        }
      })
      .catch((error) => console.error("Error fetching sources:", error));
  }, []);

  // 2. Download + parse the selected CSV
  useEffect(() => {
    if (!selectedFile) return;
    fetch(`http://127.0.0.1:5000/download/${selectedFile}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.text();
      })
      .then((csvText) => {
        const parsed = Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });
        console.log("Parsed CSV Data from", selectedFile, parsed.data);
        setBoatsData(parsed.data);
      })
      .catch((error) => console.error("Error loading CSV:", error));
  }, [selectedFile]);

  // 3. Compute the overall time range based on the "timestamp" field
  useEffect(() => {
    if (boatsData && boatsData.length > 0) {
      // Filter rows that have a valid timestamp
      const times = boatsData
        .filter((row) => row.timestamp)
        .map((row) => new Date(row.timestamp).getTime());
      if (times.length > 0) {
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        console.log("Time Range:", { min: minTime, max: maxTime });
        setTimeRange({ min: minTime, max: maxTime });
        // Default selectedTime to the max (latest)
        if (selectedTime === null) {
          setSelectedTime(maxTime);
        }
      }
    }
  }, [boatsData, selectedTime]);

  // 4. Filter + build heatmap data
  useEffect(() => {
    if (boatsData && selectedTime !== null) {
      // For each boat, find the latest snapshot at or before selectedTime
      const latestSnapshots = {};
      boatsData.forEach((row) => {
        // row.timestamp is a string, parse to a Date
        const snapshotTime = new Date(row.timestamp).getTime();
        if (snapshotTime <= selectedTime) {
          // If no snapshot stored yet OR this one is more recent, store it
          if (
            !latestSnapshots[row.boat_id] ||
            new Date(latestSnapshots[row.boat_id].timestamp).getTime() <
              snapshotTime
          ) {
            latestSnapshots[row.boat_id] = row;
          }
        }
      });

      const filteredArray = Object.values(latestSnapshots);
      console.log("Filtered Boats:", filteredArray);
      setFilteredBoats(filteredArray);

      // Build heatmap data: [latitude, longitude, value]
      // "chaos" => wind_g, "temperature" => temperature
      const heatData = filteredArray.map((row) => {
        const lat = parseFloat(row.latitude) || 0;
        const lng = parseFloat(row.longitude) || 0;
        const value =
          dataType === "temperature"
            ? parseFloat(row.temperature) || 0
            : parseFloat(row.wind_g) || 0; // <== using wind_g if dataType = chaos
        return [lat, lng, value];
      });
      console.log("Heatmap Data:", heatData);
      setHeatmapData(heatData);
    }
  }, [boatsData, selectedTime, dataType]);

  // 5. Heatmap layer
  const HeatmapLayer = () => {
    const map = useMap();
    useEffect(() => {
      if (heatmapData.length > 0) {
        const heatLayer = L.heatLayer(heatmapData, {
          radius: 50,
          blur: 50,
          maxZoom: 10,
        }).addTo(map);
        return () => {
          map.removeLayer(heatLayer);
        };
      }
    }, [map, heatmapData]);
    return null;
  };

  // 6. Boat markers
  const BoatMarkers = () => {
    return (
      <>
        {filteredBoats.map((b) => {
          const lat = parseFloat(b.latitude) || 0;
          const lng = parseFloat(b.longitude) || 0;
          return (
            <Marker
              key={`${b.boat_id}-${b.timestamp}`}
              position={[lat, lng]}
              icon={boatIcon}
            >
              <Popup>
                <strong>{b.boat_id}</strong>
                <br />
                Latitude: {lat.toFixed(6)}
                <br />
                Longitude: {lng.toFixed(6)}
                <br />
                Time: {new Date(b.timestamp).toLocaleString()}
                <br />
                {dataType === "temperature"
                  ? `Temperature: ${b.temperature}`
                  : `Wind Gust: ${b.wind_g}`}
              </Popup>
            </Marker>
          );
        })}
      </>
    );
  };

  // Fix Leaflet icon paths
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });

  // Draggable color-scale legend
  const ColorScaleLegend = () => {
    useEffect(() => {
      if (
        legendRef.current &&
        legendPosition.x === null &&
        legendPosition.y === null
      ) {
        const mapContainer = document.querySelector(".leaflet-container");
        const mapRect = mapContainer.getBoundingClientRect();
        const legendRect = legendRef.current.getBoundingClientRect();
        const x = mapRect.right - legendRect.width - 20;
        const y = mapRect.bottom - legendRect.height - 20;
        setLegendPosition({ x, y });
      }
    }, [legendPosition.x, legendPosition.y]);

    const handleMouseDown = (e) => {
      isDragging.current = true;
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      legendStartPos.current = { x: legendPosition.x, y: legendPosition.y };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (isDragging.current) {
        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        let newX = legendStartPos.current.x + dx;
        let newY = legendStartPos.current.y + dy;
        const mapContainer = document.querySelector(".leaflet-container");
        const mapRect = mapContainer.getBoundingClientRect();
        const legendRect = legendRef.current.getBoundingClientRect();
        const minX = mapRect.left;
        const maxX = mapRect.right - legendRect.width;
        const minY = mapRect.top;
        const maxY = mapRect.bottom - legendRect.height;
        newX = Math.max(minX, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));
        setLegendPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    return (
      <div
        ref={legendRef}
        className="color-scale-legend"
        onMouseDown={handleMouseDown}
        style={{ top: `${legendPosition.y}px`, left: `${legendPosition.x}px` }}
      >
        <strong>
          {dataType === "temperature" ? "Temperature" : "Wind Gust"}
        </strong>
        <div
          className={`legend-scale ${
            dataType === "temperature" ? "temperature-scale" : "chaos-scale"
          }`}
        ></div>
        <div className="legend-labels">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>
    );
  };

  // Handlers
  const handleDataTypeChange = (e) => {
    setDataType(e.target.value);
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.value);
    setSelectedTime(null);
    setTimeRange({ min: null, max: null });
    setBoatsData([]);
  };

  const toggleBoatMarkers = () => {
    setShowBoatMarkers(!showBoatMarkers);
  };

  return (
    <div className="heatmap-container">
      <div className="controls">
        <div className="file-selector">
          <label>Select CSV File: </label>
          {csvFiles.length > 0 ? (
            <select value={selectedFile} onChange={handleFileChange}>
              {csvFiles.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
          ) : (
            <p>No sources available. Please upload a CSV file.</p>
          )}
        </div>

        <div className="data-type-selector">
          <label>Select Data Type: </label>
          <select value={dataType} onChange={handleDataTypeChange}>
            <option value="temperature">Temperature</option>
            <option value="chaos">Wind Gust</option>
          </select>
        </div>

        {timeRange.min !== null && timeRange.max !== null && (
          <div className="time-slider-container">
            <label>
              Time:{" "}
              {selectedTime
                ? new Date(selectedTime).toLocaleString()
                : "Loading..."}
            </label>
            <input
              type="range"
              min={timeRange.min}
              max={timeRange.max}
              step={1000}
              value={selectedTime || timeRange.max}
              onChange={(e) => setSelectedTime(Number(e.target.value))}
            />
          </div>
        )}

        <div className="boat-toggle">
          <button onClick={toggleBoatMarkers}>
            {showBoatMarkers ? "Hide Boat Logo" : "Show Boat Logo"}
          </button>
        </div>
      </div>

      <MapContainer
        center={[37.866942, -122.315452]}
        zoom={14}
        style={{ height: "600px", width: "100%" }}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        dragging={true}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HeatmapLayer />
        {showBoatMarkers && <BoatMarkers />}
      </MapContainer>

      <ColorScaleLegend />

      {/* Simple preview of the entire parsed CSV data */}
      <div className="data-visualization" style={{ marginTop: "20px" }}>
        <h3>Parsed CSV Data</h3>
        <pre
          style={{
            maxHeight: "300px",
            overflowY: "scroll",
            background: "#f0f0f0",
            padding: "10px",
          }}
        >
          {JSON.stringify(boatsData, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default HeatmapWindow;
