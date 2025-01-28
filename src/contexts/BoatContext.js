import React, { createContext, useState, useEffect, useCallback } from "react";
import { useSocket } from "./SocketContext";

export const BoatContext = createContext();

export const BoatProvider = ({ children }) => {
  const [boats, setBoats] = useState([]);
  const { socket } = useSocket();

  const handleBoatData = useCallback(
    (data) => {
      if (!data || !data.boat_id || typeof data.data !== "object") {
        console.error("Invalid boat data received:", data);
        return;
      }

      const time_now = new Date().toISOString();

      setBoats((prevBoats) => {
        const existingBoat = prevBoats.find(
          (boat) => boat.boat_id === data.boat_id
        );

        if (existingBoat) {
          // Update existing boat
          return prevBoats.map((boat) =>
            boat.boat_id === data.boat_id
              ? {
                  ...boat,
                  data: {
                    ...boat.data,
                    ...data.data,
                    time_now,
                  },
                }
              : boat
          );
        } else {
          // Add new boat
          return [
            ...prevBoats,
            {
              boat_id: data.boat_id,
              data: {
                ...data.data,
                time_now,
              },
            },
          ];
        }
      });
    },
    [setBoats]
  );

  useEffect(() => {
    if (socket) {
      // Listen for real-time boat data
      socket.on("boat_data", handleBoatData);

      // Listen for `boat_locations` for bulk updates
      socket.on("boat_locations", (data) => {
        if (Array.isArray(data)) {
          console.log("Received boat locations:", data);
          setBoats(
            data.map((b) => ({
              boat_id: b.boat_id,
              data: {
                ...b,
                time_now: new Date().toISOString(),
              },
            }))
          );
        } else {
          console.error("Invalid boat_locations format:", data);
        }
      });

      return () => {
        socket.off("boat_data", handleBoatData);
        socket.off("boat_locations");
      };
    }
  }, [socket, handleBoatData]);

  return (
    <BoatContext.Provider value={{ boats, setBoats }}>
      {children}
    </BoatContext.Provider>
  );
};
