import { useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

export type MapArea = { south: number; north: number; west: number; east: number; lat: number; lng: number };

export function MapAreaObserver({ onChange, onManualPan }: { onChange: (area: MapArea) => void; onManualPan: () => void }) {
  const map = useMap();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const moving = useRef(false);
  const publish = () => {
    if (moving.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (moving.current) return;
      const bounds = map.getBounds();
      const center = map.getCenter();
      const round = (value: number) => Number(value.toFixed(6));
      onChange({
        south: round(bounds.getSouth()), north: round(bounds.getNorth()),
        west: round(bounds.getWest()), east: round(bounds.getEast()),
        lat: round(center.lat), lng: round(center.lng),
      });
    }, 200);
  };
  useMapEvents({
    movestart: () => { moving.current = true; clearTimeout(timer.current); },
    moveend: () => { moving.current = false; publish(); },
    zoomend: publish, resize: publish, dragend: onManualPan,
  });
  useEffect(() => {
    publish();
    return () => clearTimeout(timer.current);
  }, [map, onChange]);
  return null;
}
