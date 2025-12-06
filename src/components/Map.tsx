"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, useMapEvents, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

// Blue icon for real GPS
const blueIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Red icon for simulated/warning
const redIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface MapProps {
    patients: any[];
    selectedPatient?: any;
    geofences?: { lat: number, lng: number, radius: number, color?: string }[];
    onMapClick?: (lat: number, lng: number) => void;
}

// Helper component to handle map movement
function FlyToLocation({ location }: { location: { lat: number, lng: number } }) {
    const map = useMap();
    useEffect(() => {
        if (location) {
            map.flyTo([location.lat, location.lng], 15, {
                duration: 1.5
            });
        }
    }, [location, map]);
    return null;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

export default function Map({ patients, selectedPatient, geofences = [], onMapClick }: MapProps) {
    // Default center (can be user's location or first patient)
    const center: [number, number] = patients.length > 0 && patients[0].location
        ? [patients[0].location.lat, patients[0].location.lng]
        : [12.9716, 77.5946]; // Default to Bangalore

    return (
        <MapContainer id="map-container" center={center} zoom={13} style={{ height: "100%", width: "100%", borderRadius: "1rem" }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Handle FlyTo */}
            {selectedPatient && selectedPatient.location && (
                <FlyToLocation location={selectedPatient.location} />
            )}

            {onMapClick && <MapClickHandler onClick={onMapClick} />}

            {/* Render Geofences */}
            {geofences.map((geo, idx) => (
                <Circle
                    key={`geo-${idx}`}
                    center={[geo.lat, geo.lng]}
                    radius={geo.radius}
                    pathOptions={{ color: geo.color || 'red', fillColor: geo.color || 'red', fillOpacity: 0.1 }}
                />
            ))}

            {patients.map((patient) => (
                patient.location && (
                    <Marker
                        key={patient.id}
                        position={[patient.location.lat, patient.location.lng]}
                        icon={patient.isSimulated ? redIcon : blueIcon}
                    >
                        <Popup>
                            <div className="p-2">
                                <h3 className="font-bold">{patient.name || patient.email}</h3>
                                <p className="text-sm text-gray-600">
                                    Status: {patient.status || "Unknown"}
                                    {patient.isSimulated && <span className="text-red-500 font-bold ml-1">(Simulated)</span>}
                                </p>
                                <p className="text-xs text-gray-400">Last active: {new Date(patient.lastActive).toLocaleTimeString()}</p>
                            </div>
                        </Popup>
                    </Marker>
                )
            ))}

            {/* History Path */}
            {selectedPatient && selectedPatient.history && selectedPatient.history.length > 0 && (
                <Polyline
                    positions={selectedPatient.history.map((h: any) => [h.lat, h.lng])}
                    pathOptions={{ color: 'blue', weight: 4, opacity: 0.6, dashArray: '10, 10' }}
                />
            )}
        </MapContainer>
    );
}
