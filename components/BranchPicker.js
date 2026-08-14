"use client";

import { useMemo, useState } from "react";
import { Check, LocateFixed, MapPin, Search, X } from "lucide-react";
import branchLocations from "@/data/branchLocations.json";
import {
  nearestBranchLocations,
  normalizeLocationQuery,
  searchBranchLocations,
} from "@/lib/branchLocator.mjs";

const MAX_RESULTS = 8;

function resultDistance(distance) {
  if (distance == null) return null;
  return distance < 10 ? `${distance.toFixed(1)} mi` : `${Math.round(distance)} mi`;
}

function BranchResult({ location, distance, selected, onSelect }) {
  return (
    <button className="branch-result" type="button" onClick={() => onSelect(location)}>
      <span className="branch-result-icon" aria-hidden="true">
        {selected ? <Check size={15} /> : <MapPin size={15} />}
      </span>
      <span className="branch-result-copy">
        <span className="branch-result-name">{location.name}</span>
        <span className="branch-result-meta">
          {location.systemName}
          {location.beta && <span className="beta-badge">Beta</span>}
          <span aria-hidden="true"> · </span>
          {location.city}, {location.state} {location.postalCode}
        </span>
      </span>
      {distance != null && <span className="branch-result-distance">{resultDistance(distance)}</span>}
    </button>
  );
}

export default function BranchPicker({ currentLibrary, currentBranch, onSelect, onBrowseAll, onClose }) {
  const [query, setQuery] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const current = branchLocations.find(
    (location) => location.library === currentLibrary && location.code === currentBranch,
  );

  const results = useMemo(() => {
    if (userLocation) {
      return nearestBranchLocations(branchLocations, userLocation, MAX_RESULTS);
    }

    return searchBranchLocations(branchLocations, query, MAX_RESULTS)
      .map((location) => ({ location, distance: null }));
  }, [query, userLocation]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError("Location is not available in this browser. Search by ZIP or branch instead.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setQuery("");
        setLocating(false);
      },
      (error) => {
        const denied = error.code === 1;
        setLocationError(
          denied
            ? "Location was not shared. Search by ZIP, city, or branch instead."
            : "We couldn't get your location. Search by ZIP, city, or branch instead.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  const hasSearch = normalizeLocationQuery(query).length > 0;
  const resultLabel = userLocation ? "Nearest branches" : "Matching branches";

  return (
    <div className="branch-picker" role="dialog" aria-modal="false" aria-labelledby="branch-picker-title">
      <div className="branch-picker-header">
        <div>
          <p className="branch-picker-eyebrow">Library location</p>
          <h2 id="branch-picker-title">Choose a branch</h2>
        </div>
        <button className="btn-icon" type="button" onClick={onClose} aria-label="Close branch picker">
          <X size={16} />
        </button>
      </div>

      <div className="branch-search-wrap">
        <Search size={16} aria-hidden="true" />
        <input
          className="branch-search"
          type="search"
          inputMode="search"
          placeholder="ZIP, city, address, or branch name"
          aria-label="Search library branches"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setUserLocation(null);
          }}
        />
      </div>

      <button className="use-location-button" type="button" onClick={useMyLocation} disabled={locating}>
        <LocateFixed size={16} aria-hidden="true" />
        {locating ? "Finding nearby branches…" : "Use my location"}
      </button>

      {locationError && <p className="branch-picker-error" role="status">{locationError}</p>}

      {!hasSearch && !userLocation && current && (
        <div className="branch-result-section">
          <p className="branch-result-label">Current branch</p>
          <BranchResult location={current} selected onSelect={onSelect} />
        </div>
      )}

      {(hasSearch || userLocation) && (
        <div className="branch-result-section" aria-live="polite">
          <p className="branch-result-label">{resultLabel}</p>
          <div className="branch-results">
            {results.map(({ location, distance }) => (
              <BranchResult
                key={`${location.library}:${location.code}`}
                location={location}
                distance={distance}
                selected={location.library === currentLibrary && location.code === currentBranch}
                onSelect={onSelect}
              />
            ))}
          </div>
          {results.length === 0 && (
            <p className="branch-picker-empty">No nearby match. Try a ZIP code, city, or shorter branch name.</p>
          )}
        </div>
      )}

      <button className="browse-all-button" type="button" onClick={onBrowseAll}>
        Browse all branches and systems
      </button>
      <p className="location-privacy">Precise location is used only on this device to rank nearby branches.</p>
    </div>
  );
}
