import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CircleMarker, MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  ArrowUpRight,
  CarFront,
  Clock3,
  ChevronLeft,
  ChevronRight,
  List,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { getListParkingLotsQueryKey, useListParkingLots, type District, type GeographicPlace, type ListParkingLotsParams, type ParkingLot } from '@workspace/api-client-react';
import { ParkingSearch } from '@/components/parking-search';
import { ParkingReportControls } from '@/components/parking-report-controls';
import { MapAreaObserver, type MapArea } from '@/components/map-area';
import { getLotStatus as statusFor } from '@/lib/parking-status';
import type { LotStatus } from '@/lib/parking-status';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import './index.css';

const queryClient = new QueryClient();
const ISTANBUL_CENTER: [number, number] = [41.0082, 28.9784];
type Language = 'tr' | 'en';
type StatusFilter = 'all' | LotStatus;
type Detent = 'collapsed' | 'half' | 'full';

const copy = {
  tr: {
    subtitle: 'İstanbul · Örnek otopark verileri',
    legendAvailable: 'Boş yer çok',
    legendFew: 'Az yer kaldı',
    legendFull: 'Dolu',
    legendStale: 'Eski bilgi',
    lotCount: (count: number) => `${count} otopark`,
    spaces: 'boş yer',
    spaceSingular: 'boş yer',
    priceUnit: 'saat',
    updatedNow: 'Az önce güncellendi',
    updatedMinutes: (minutes: number) => `${minutes} dk önce güncellendi`,
    updatedHours: (hours: number) => `${hours} sa önce güncellendi`,
    many: 'Çok boş yer',
    few: 'Az yer kaldı',
    full: 'Dolu',
    stale: 'Bilgi eski',
    navigate: 'Yol tarifi al',
    loadingTitle: 'Otoparklar yükleniyor',
    loadingDescription: 'Harita çevresindeki boş yerleri getiriyoruz.',
    errorTitle: 'Otopark bilgisi alınamadı',
    errorDescription: 'Bağlantınızı kontrol edip yeniden deneyin.',
    retry: 'Yeniden dene',
    emptyTitle: 'Yakında otopark bulunamadı',
    emptyDescription: 'Bu harita alanında listelenecek otopark verisi yok.',
    parking: 'Otopark',
    searchPlaceholder: 'Otopark ara',
    nearest: 'Yakındaki otoparklar',
    filters: 'Durum filtresi',
    all: 'Tümü',
    locate: 'Konumumu bul',
    locationDenied: 'Konum izni alınamadı. Tarayıcı ayarlarından izin verin.',
    locationUnavailable: 'Konumunuz şu anda belirlenemiyor.',
    noMatches: 'Bu aramayla eşleşen otopark yok',
    clearSearch: 'Aramayı temizle',
    covered: 'Kapalı',
    ev: 'Elektrikli araç şarjı',
    findNearMe: 'Yakınımda otopark bul',
    locating: 'Konum bulunuyor…',
    locationConsentTitle: 'Konumunuzu kullanmamıza izin verin',
    locationConsentBody: 'Yakındaki otoparkları uzaklığa göre sıralamak için konumunuz bir kez alınır ve mesafe hesabı için sunucuya gönderilir. Konumunuz kaydedilmez.',
    locationConsentContinue: 'Konum iznini aç',
    locationConsentCancel: 'Vazgeç',
    filterPriceTitle: 'Saatlik fiyat aralığı',
    minimumPrice: 'En az ₺',
    maximumPrice: 'En çok ₺',
    openNow: 'Şu an açık',
    priceRangeError: 'En düşük fiyat, en yüksek fiyattan fazla olamaz.',
    carMode: 'Sürüş modu',
    carModeOn: 'Sürüş modundan çık',
    distance: 'Mesafe',
  },
  en: {
    subtitle: 'Istanbul · Sample parking data',
    legendAvailable: 'Plenty free',
    legendFew: 'Few left',
    legendFull: 'Full',
    legendStale: 'Older data',
    lotCount: (count: number) => `${count} parking ${count === 1 ? 'lot' : 'lots'}`,
    spaces: 'free spots',
    spaceSingular: 'free spot',
    priceUnit: 'hour',
    updatedNow: 'Updated just now',
    updatedMinutes: (minutes: number) => `Updated ${minutes} min ago`,
    updatedHours: (hours: number) => `Updated ${hours} hr ago`,
    many: 'Plenty available',
    few: 'Few spots left',
    full: 'Full',
    stale: 'Data is old',
    navigate: 'Get directions',
    loadingTitle: 'Loading parking',
    loadingDescription: 'Finding available spaces around the map.',
    errorTitle: 'Could not load parking',
    errorDescription: 'Check your connection and try again.',
    retry: 'Try again',
    emptyTitle: 'No nearby parking found',
    emptyDescription: 'There is no parking data to show in this map area.',
    parking: 'Parking',
    searchPlaceholder: 'Search parking',
    nearest: 'Parking nearby',
    filters: 'Availability filter',
    all: 'All',
    locate: 'My location',
    locationDenied: 'Location access was not granted. Allow it in your browser settings.',
    locationUnavailable: 'Your location is unavailable right now.',
    noMatches: 'No parking matches this search',
    clearSearch: 'Clear search',
    covered: 'Covered',
    ev: 'EV charging',
    findNearMe: 'Find parking near me',
    locating: 'Finding your location…',
    locationConsentTitle: 'Allow location access',
    locationConsentBody: 'Your location is used once to sort nearby parking by distance and is sent to the server for the distance calculation. It is not saved.',
    locationConsentContinue: 'Continue to location permission',
    locationConsentCancel: 'Cancel',
    filterPriceTitle: 'Hourly price range',
    minimumPrice: 'Min ₺',
    maximumPrice: 'Max ₺',
    openNow: 'Open now',
    priceRangeError: 'Minimum price cannot be higher than maximum price.',
    carMode: 'Drive mode',
    carModeOn: 'Exit drive mode',
    distance: 'Distance',
  },
} satisfies Record<Language, Record<string, unknown>>;

function getUpdatedMinutes(updatedAt: string): number {
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
}

function displayLotName(lot: ParkingLot): string {
  return lot.is_demo ? `${lot.name} · DEMO` : lot.name;
}

function distanceLabel(lot: ParkingLot, walking: boolean, language: Language): string {
  if (!walking) return `${lot.distance_km?.toFixed(1) ?? '—'} km`;
  if (lot.walking_distance_m == null) return '—';
  const value = lot.walking_distance_m < 1000 ? `${Math.round(lot.walking_distance_m)} m` : `${(lot.walking_distance_m / 1000).toFixed(1)} km`;
  return `${value} ${language === 'tr' ? 'yürüyüş' : 'walk'}`;
}

function statusLabel(status: LotStatus, language: Language) {
  const labels = copy[language];
  if (status === 'available') return labels.many as string;
  if (status === 'few') return labels.few as string;
  if (status === 'full') return labels.full as string;
  return labels.stale as string;
}

function relativeUpdated(updatedAt: string, language: Language) {
  const minutes = getUpdatedMinutes(updatedAt);
  if (minutes < 1) return copy[language].updatedNow as string;
  if (minutes < 60) return (copy[language].updatedMinutes as (value: number) => string)(minutes);
  return (copy[language].updatedHours as (value: number) => string)(Math.floor(minutes / 60));
}

function makeLotIcon(lot: ParkingLot, selected: boolean) {
  const status = statusFor(lot);
  const icon = L.divIcon({
    className: 'lot-marker-root',
    html: `<span class="lot-marker lot-marker--${status}${selected ? ' lot-marker--selected' : ''}"><span class="lot-marker__number">${Math.max(0, lot.free_spots)}</span></span>`,
    iconSize: [58, 44],
    iconAnchor: [29, 22],
  });
  return icon;
}

function makeClusterIcon(count: number, language: Language) {
  return L.divIcon({
    className: 'lot-cluster-root',
    html: `<span class="lot-cluster"><span class="lot-cluster__count">${count}</span><span class="lot-cluster__label">${language === 'tr' ? 'otopark' : 'lots'}</span></span>`,
    iconSize: [58, 44],
    iconAnchor: [29, 22],
  });
}

function useMapColorScheme() {
  const [isDark, setIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (event: MediaQueryListEvent) => setIsDark(event.matches);
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isDark;
}

function ClusteredLotMarkers({
  lots,
  selectedId,
  onSelectLot,
  language,
}: {
  lots: ParkingLot[];
  selectedId: number | null;
  onSelectLot: (lot: ParkingLot) => void;
  language: Language;
}) {
  const map = useMap();
  const [revision, setRevision] = useState(0);
  useMapEvents({
    zoomend: () => setRevision((value) => value + 1),
    moveend: () => setRevision((value) => value + 1),
  });

  const groups = useMemo(() => {
    const zoom = map.getZoom();
    const clusters = new Map<string, { center: [number, number]; lots: ParkingLot[] }>();
    for (const lot of lots) {
      const point = map.project([lot.lat, lot.lng], zoom);
      const key = zoom >= 15 ? `lot-${lot.id}` : `${Math.floor(point.x / 96)}:${Math.floor(point.y / 96)}`;
      const match = clusters.get(key);
      if (match) {
        const count = match.lots.length;
        match.center = [(match.center[0] * count + lot.lat) / (count + 1), (match.center[1] * count + lot.lng) / (count + 1)];
        match.lots.push(lot);
      } else {
        clusters.set(key, { center: [lot.lat, lot.lng], lots: [lot] });
      }
    }
    return [...clusters.values()];
  }, [lots, map, revision, selectedId]);

  return (
    <>
      {groups.map((group) => {
        if (map.getZoom() < 15) {
          return (
            <Marker
              key={`cluster-${group.lots.map((lot) => lot.id).join('-')}`}
              position={group.center}
              icon={makeClusterIcon(group.lots.length, language)}
              title={language === 'tr' ? `${group.lots.length} otopark` : `${group.lots.length} parking lots`}
              eventHandlers={{
                click: () => map.setView(group.center, Math.min(map.getMaxZoom(), map.getZoom() + 2), { animate: true }),
              }}
            />
          );
        }

        const lot = group.lots[0];
        const selected = selectedId === lot.id;
        return (
          <Marker
            key={lot.id}
            position={[lot.lat, lot.lng]}
            icon={makeLotIcon(lot, selected)}
            zIndexOffset={selected ? 1000 : 0}
            eventHandlers={{ click: () => onSelectLot(lot) }}
            title={`${displayLotName(lot)}: ${lot.free_spots} free spots`}
          />
        );
      })}
    </>
  );
}

function MapTapHandler({ onMapTap }: { onMapTap: () => void }) {
  useMapEvents({ click: onMapTap });
  return null;
}

function MapViewport({ target, selectedId, zoom }: { target: [number, number] | null; selectedId: number | null; zoom: number }) {
  const map = useMap();
  const lastTarget = useRef<string | null>(null);
  useEffect(() => {
    if (!target) return;
    const key = `${target[0].toFixed(5)},${target[1].toFixed(5)},${selectedId ?? ''},${zoom}`;
    if (lastTarget.current === key) return;
    lastTarget.current = key;
    map.flyTo(target, zoom, { duration: 0.55 });
  }, [map, target, selectedId, zoom]);
  return null;
}

function MapPanelResize({ open, carMode }: { open: boolean; carMode: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize({ pan: false }), 275);
    return () => window.clearTimeout(timer);
  }, [map, open, carMode]);
  return null;
}

function ParkingMap() {
  const [language, setLanguage] = useState<Language>('tr');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [coveredOnly, setCoveredOnly] = useState(false);
  const [evOnly, setEvOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [detent, setDetent] = useState<Detent>('half');
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locationPending, setLocationPending] = useState(false);
  const [locationAccepted, setLocationAccepted] = useState(false);
  const [locationConsentOpen, setLocationConsentOpen] = useState(false);
  const [carMode, setCarMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => {
    try { return localStorage.getItem('fatih-park-panel-open') !== 'false'; }
    catch { return true; }
  });
  const panelSwipe = useRef<{ x: number; y: number } | null>(null);
  const suppressPanelSwipeClickUntil = useRef(0);
  const panelEdge = useRef<HTMLDivElement>(null);
  const [viewportTarget, setViewportTarget] = useState<[number, number] | null>(null);
  const [targetZoom, setTargetZoom] = useState(15);
  const [destination, setDestination] = useState<GeographicPlace | null>(null);
  const [areaSearchVisible, setAreaSearchVisible] = useState(false);
  const onManualPan = useCallback(() => setAreaSearchVisible(true), []);
  const [mapArea, setMapArea] = useState<MapArea | null>(null);
  const [viewportPending, setViewportPending] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const onMapAreaChange = useCallback((area: MapArea) => { setMapArea(area); setViewportPending(false); }, []);
  const dragStart = useRef<number | null>(null);
  const [clock, setClock] = useState(0);
  const text = copy[language];
  const isDarkMap = useMapColorScheme();
  const minPriceValue = priceMin === '' ? undefined : Number(priceMin);
  const maxPriceValue = priceMax === '' ? undefined : Number(priceMax);
  const priceRangeInvalid = minPriceValue !== undefined && maxPriceValue !== undefined && minPriceValue > maxPriceValue;
  const queryParams = useMemo<ListParkingLotsParams>(() => {
    const params: ListParkingLotsParams = mapArea ? { ...mapArea } : {};
    if (userPosition) {
      params.lat = userPosition[0];
      params.lng = userPosition[1];
    }
    if (destination) {
      params.lat = destination.lat;
      params.lng = destination.lng;
      params.walking = true;
    }
    if (!priceRangeInvalid && minPriceValue !== undefined) params.price_min = minPriceValue;
    if (!priceRangeInvalid && maxPriceValue !== undefined) params.price_max = maxPriceValue;
    if (coveredOnly) params.covered = true;
    if (evOnly) params.ev_charging = true;
    if (openNowOnly) params.open_now = true;
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    return params;
  }, [mapArea, debouncedSearch, userPosition, destination, minPriceValue, maxPriceValue, priceRangeInvalid, coveredOnly, evOnly, openNowOnly]);
  const { data: lots, isLoading, isError, refetch } = useListParkingLots(queryParams, {
    query: { queryKey: getListParkingLotsQueryKey(queryParams), refetchInterval: 30_000, enabled: mapArea !== null && !viewportPending },
  });
  const visibleLots = useMemo(() => (lots ?? [])
    .filter((lot) => filter === 'all' || statusFor(lot) === filter), [lots, language, search, filter, clock]);
  const selectedLot = visibleLots.find((lot) => lot.id === selectedId);
  const nearbyTitle = destination ? (language === 'tr' ? `${destination.name} yakınındaki otoparklar` : `Parking near ${destination.name}`) : text.nearest as string;
  const walkingWarning = destination && (lots ?? []).some((lot) => lot.walking_distance_status === 'unavailable')
    ? (language === 'tr' ? 'Bazı yürüyüş rotaları hesaplanamadı. Eksik mesafeler — ile gösterilir.' : 'Some walking routes are unavailable. Missing distances are shown as —.') : '';
  const filterLabels: Record<StatusFilter, string> = {
    all: text.all as string,
    available: language === 'tr' ? 'Boş yer çok' : 'Plenty free',
    few: language === 'tr' ? 'Az yer' : 'Few left',
    full: language === 'tr' ? 'Dolu' : 'Full',
    stale: language === 'tr' ? 'Eski bilgi' : 'Older data',
  };

  const requestLocation = () => {
    setLocationError('');
    setLocationPending(true);
    if (!navigator.geolocation) {
      setLocationError(text.locationUnavailable as string);
      setLocationPending(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position: [number, number] = [coords.latitude, coords.longitude];
        setUserPosition(position);
        setDestination(null);
        setAreaSearchVisible(false);
        setTargetZoom(15);
        setViewportTarget(position);
        setLocationPending(false);
      },
      (error) => {
        setLocationError(error.code === error.PERMISSION_DENIED ? text.locationDenied as string : text.locationUnavailable as string);
        setLocationPending(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };
  const findNearMe = () => {
    if (locationAccepted) requestLocation();
    else setLocationConsentOpen(true);
  };
  const confirmLocationConsent = () => {
    setLocationConsentOpen(false);
    setLocationAccepted(true);
    requestLocation();
  };
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let mounted = true;
    if (!navigator.geolocation) return;
    if (!navigator.permissions) { setLocationConsentOpen(true); return; }
    void navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (!mounted) return;
      if (permission.state === 'granted') { setLocationAccepted(true); requestLocation(); }
      else if (permission.state === 'prompt') setLocationConsentOpen(true);
    }).catch(() => { if (mounted) setLocationConsentOpen(true); });
    return () => { mounted = false; };
  }, []);

  const selectLot = (lot: ParkingLot) => {
    setSelectedId(lot.id);
    setTargetZoom(16);
    if (window.matchMedia('(min-width: 768px)').matches) setPanelOpen(true);
    setViewportTarget([lot.lat, lot.lng]);
    setDetent('full');
    setAreaSearchVisible(false);
  };
  const selectSearchLot = (lot: ParkingLot) => { setDestination(null); selectLot(lot); };
  const selectDestination = (place: GeographicPlace) => {
    setViewportPending(true);
    setDestination(place);
    setSelectedId(null);
    setTargetZoom(16);
    setViewportTarget([place.lat, place.lng]);
    setAreaSearchVisible(false);
    setDetent('half');
    if (window.matchMedia('(min-width: 768px)').matches) setPanelOpen(true);
  };
  const selectDistrict = (district: District) => {
    selectDestination({
      id: `district:${district.id}`, kind: 'district', name: language === 'tr' ? district.name_tr : district.name_en,
      label: 'İstanbul', lat: district.center_lat, lng: district.center_lng,
    });
  };
  const searchOrigin: [number, number] = userPosition ?? (mapArea ? [mapArea.lat, mapArea.lng] : ISTANBUL_CENTER);

  const toggleCarMode = () => {
    if (!carMode) setPanelOpen(false);
    else {
      try { setPanelOpen(localStorage.getItem('fatih-park-panel-open') !== 'false'); }
      catch { setPanelOpen(true); }
    }
    setCarMode((value) => !value);
  };
  const startPanelSwipe = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') return;
    panelSwipe.current = { x: event.clientX, y: event.clientY };
  };
  const updatePanelSwipe = (x: number, y: number, opening: boolean) => {
    const start = panelSwipe.current;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5
      && (opening ? dx > 0 : dx < 0)) {
      panelSwipe.current = null;
      suppressPanelSwipeClickUntil.current = Date.now() + 500;
      setPanelOpen(opening);
    }
  };
  const endPanelSwipe = (event: PointerEvent<HTMLElement>, opening: boolean) => {
    updatePanelSwipe(event.clientX, event.clientY, opening);
    panelSwipe.current = null;
  };
  useEffect(() => {
    const edge = panelEdge.current;
    if (!edge) return;
    // Native non-passive listeners keep a screen-edge swipe from navigating
    // browser history before the panel can consume the gesture.
    const start = (event: TouchEvent) => {
      event.preventDefault();
      const touch = event.touches[0];
      if (touch) panelSwipe.current = { x: touch.clientX, y: touch.clientY };
    };
    const move = (event: TouchEvent) => {
      event.preventDefault();
      const touch = event.touches[0];
      if (touch) updatePanelSwipe(touch.clientX, touch.clientY, true);
    };
    edge.addEventListener('touchstart', start, { passive: false });
    edge.addEventListener('touchmove', move, { passive: false });
    return () => {
      edge.removeEventListener('touchstart', start);
      edge.removeEventListener('touchmove', move);
    };
  }, [panelOpen]);
  useEffect(() => {
    if (!carMode) {
      try { localStorage.setItem('fatih-park-panel-open', String(panelOpen)); }
      catch { /* Storage can be unavailable in private browsing. */ }
    }
  }, [panelOpen, carMode]);
  useEffect(() => {
    if (search.trim() && window.matchMedia('(min-width: 768px)').matches) setPanelOpen(true);
  }, [search]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== '[' || event.repeat || event.ctrlKey || event.metaKey || event.altKey
        || target?.closest('input, textarea, select, [contenteditable="true"]')
        || !window.matchMedia('(min-width: 768px)').matches) return;
      event.preventDefault();
      setPanelOpen((value) => !value);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onHandlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onHandlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragStart.current === null) return;
    const delta = event.clientY - dragStart.current;
    dragStart.current = null;
    if (Math.abs(delta) < 18) {
      setDetent((value) => value === 'collapsed' ? 'half' : value === 'half' ? 'full' : 'collapsed');
    } else if (delta < 0) {
      setDetent((value) => value === 'collapsed' ? 'half' : 'full');
    } else {
      setDetent((value) => value === 'full' ? 'half' : 'collapsed');
    }
  };

  useEffect(() => {
    const now = Date.now();
    const expiries = (lots ?? []).flatMap((lot) => [
      Date.parse(lot.updated_at) + 60 * 60_000 + 1,
      ...(lot.recent_reports ?? []).map((report) => Date.parse(report.created_at) + 30 * 60_000),
    ]).filter((time) => time > now);
    const delay = Math.max(1, Math.min(60_000, ...expiries.map((time) => time - now + 1)));
    const timer = window.setTimeout(() => setClock((value) => value + 1), delay);
    return () => window.clearTimeout(timer);
  }, [lots, clock]);
  useEffect(() => {
    if (!viewportPending) return;
    const timer = window.setTimeout(() => setViewportPending(false), 1200);
    return () => window.clearTimeout(timer);
  }, [viewportPending]);

  return (
    <main className={`park-app ${panelOpen ? 'side-panel-open' : 'side-panel-closed'}${carMode ? ' car-mode' : ''}`} data-testid="screen-parking-map"
      onClickCapture={(event) => {
        if (event.detail > 0 && Date.now() < suppressPanelSwipeClickUntil.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}>
      <div className="park-map" data-testid="map-fatih">
        <MapContainer
          className={isDarkMap ? 'leaflet-map--dark' : undefined}
          center={ISTANBUL_CENTER}
          zoom={10}
          minZoom={8}
          maxZoom={19}
          zoomControl={false}
          scrollWheelZoom
          attributionControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">FOSSGIS routing</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Fix the map</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewport target={viewportTarget} selectedId={selectedId} zoom={targetZoom} />
          <MapAreaObserver onChange={onMapAreaChange} onManualPan={onManualPan} />
          <MapPanelResize open={panelOpen} carMode={carMode} />
          <ZoomControl position="bottomright" />
          <MapTapHandler onMapTap={() => setSelectedId(null)} />
          <ClusteredLotMarkers lots={visibleLots} selectedId={selectedId} onSelectLot={selectLot} language={language} />
          {userPosition && (
            <>
              <CircleMarker center={userPosition} radius={15} pathOptions={{ color: '#007aff', weight: 1, fillColor: '#007aff', fillOpacity: 0.16, interactive: false }} />
              <CircleMarker center={userPosition} radius={7} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#007aff', fillOpacity: 1 }} />
              <CircleMarker center={userPosition} radius={2} pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#ffffff', fillOpacity: 1, interactive: false }} />
            </>
          )}
          {destination && <Marker position={[destination.lat, destination.lng]} interactive={false}
            title={destination.name} icon={L.divIcon({ className: 'destination-marker-root', html: '<span class="destination-marker"></span>', iconSize: [22, 22], iconAnchor: [11, 11] })} />}
        </MapContainer>
        {areaSearchVisible && <button className="search-this-area" type="button" data-testid="button-search-this-area"
          onClick={() => {
            if (!mapArea) return;
            setDestination({ id: `area:${mapArea.lat}:${mapArea.lng}`, kind: 'place',
              name: language === 'tr' ? 'Bu alan' : 'this area', label: 'İstanbul', lat: mapArea.lat, lng: mapArea.lng });
            setSelectedId(null); setAreaSearchVisible(false); setSearch('');
          }}><Search size={18} />{language === 'tr' ? 'Bu alanda ara' : 'Search in this area'}</button>}
      </div>

      <header className="topbar desktop-topbar">
        <div className="brand-panel">
          <div className="brand-line">
            <span className="brand-mark"><CarFront size={19} strokeWidth={2.5} /></span>
            <span className="brand-name">Fatih Park</span>
          </div>
          <p className="brand-subtitle">{text.subtitle as string}</p>
        </div>
        <button className="desktop-nearby-button" type="button" onClick={findNearMe} disabled={locationPending} data-testid="button-find-nearby-desktop">
          <LocateFixed size={18} />{locationPending ? text.locating as string : text.findNearMe as string}
        </button>
        <button className="drive-mode-toggle" type="button" aria-pressed={carMode} onClick={toggleCarMode} data-testid="button-toggle-car-mode">
          <CarFront size={19} />{carMode ? text.carModeOn as string : text.carMode as string}
        </button>
        <div className="language-toggle" aria-label="Language">
          <button
            type="button"
            aria-pressed={language === 'tr'}
            data-testid="button-language-tr"
            onClick={() => setLanguage('tr')}
          >TR</button>
          <button
            type="button"
            aria-pressed={language === 'en'}
            data-testid="button-language-en"
            onClick={() => setLanguage('en')}
          >EN</button>
        </div>
      </header>

      <button
        className="side-panel-toggle"
        type="button"
        onClick={() => setPanelOpen((value) => !value)}
        aria-label={language === 'tr' ? (panelOpen ? 'Paneli kapat' : 'Paneli aç') : (panelOpen ? 'Close panel' : 'Open panel')}
        aria-expanded={panelOpen}
        aria-controls="parking-side-panel"
        data-testid="button-toggle-panel"
      >{panelOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}</button>
      {!panelOpen && <>
        <button className="side-panel-reopen" type="button" onClick={() => setPanelOpen(true)}
          aria-label={language === 'tr' ? 'Otopark listesini aç' : 'Open parking list'} aria-controls="parking-side-panel"
          data-testid="button-reopen-panel"><List size={24} /></button>
        <div ref={panelEdge} className="side-panel-swipe-edge" aria-hidden="true"
          onPointerDown={(event) => { startPanelSwipe(event); if (event.pointerType !== 'mouse') event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerUp={(event) => endPanelSwipe(event, true)}
          onPointerCancel={() => { panelSwipe.current = null; }} />
      </>}
      <aside id="parking-side-panel" className="tablet-panel" inert={!panelOpen}
        aria-label={text.nearest as string} data-testid="tablet-parking-panel"
        onPointerDown={startPanelSwipe} onPointerUp={(event) => endPanelSwipe(event, false)}
        onPointerMove={(event) => updatePanelSwipe(event.clientX, event.clientY, false)}
        onPointerCancel={(event) => { if (event.pointerType !== 'touch') panelSwipe.current = null; }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (touch) panelSwipe.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (touch) updatePanelSwipe(touch.clientX, touch.clientY, false);
        }}
        onTouchEnd={() => { panelSwipe.current = null; }}>
        <div className="tablet-panel-heading">
          <div className="tablet-panel-title">
            <span className="tablet-kicker">{language === 'tr' ? 'İSTANBUL' : 'ISTANBUL'}</span>
            <h1>{nearbyTitle}</h1>
          </div>
          <span className="tablet-result-count" data-testid="tablet-text-parking-count">{isLoading ? '—' : visibleLots.length}</span>
        </div>
        <ParkingSearch search={search} onSearch={setSearch} onDistrict={selectDistrict} onLot={selectSearchLot}
          onDestination={selectDestination} onUseLocation={findNearMe} carMode={carMode} language={language} origin={searchOrigin} />
        <div className="tablet-tools">
          <button className="tablet-location-button" type="button" onClick={findNearMe} disabled={locationPending} data-testid="tablet-button-find-nearby">
            <LocateFixed size={18} />{locationPending ? text.locating as string : text.findNearMe as string}
          </button>
          <button className={`tablet-filter-button${filterOpen ? ' is-open' : ''}`} type="button" onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen} data-testid="tablet-button-filters">
            <SlidersHorizontal size={18} />{text.filters as string}
          </button>
        </div>
        {locationError && <div className="tablet-location-error" role="status">{locationError}</div>}
        {walkingWarning && <div className="walking-warning" role="status">{walkingWarning}</div>}
        {filterOpen && (
          <div className="tablet-filter-panel" role="group" aria-label={text.filters as string} data-testid="tablet-parking-filters">
            <div className="tablet-filter-heading">{text.filters as string}</div>
            <div className="filter-status-options">
              {(Object.keys(filterLabels) as StatusFilter[]).map((value) => (
                <button key={value} type="button" className={`filter-option ${filter === value ? 'is-active' : ''}`} onClick={() => setFilter(value)} data-testid={`tablet-filter-${value}`}>
                  {value !== 'all' && <i className={`legend-dot legend-dot--${value === 'available' ? 'available' : value === 'few' ? 'few' : value === 'full' ? 'full' : 'stale'}`} />}
                  {filterLabels[value]}
                </button>
              ))}
            </div>
            <div className="filter-price">
              <div className="filter-group-title">{text.filterPriceTitle as string}</div>
              <div className="filter-price-row">
                <label className="filter-price-field"><span>{text.minimumPrice as string}</span><input type="number" min="0" step="5" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} data-testid="tablet-input-price-min" /></label>
                <label className="filter-price-field"><span>{text.maximumPrice as string}</span><input type="number" min="0" step="5" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} data-testid="tablet-input-price-max" /></label>
              </div>
              {priceRangeInvalid && <p className="filter-validation" role="alert">{text.priceRangeError as string}</p>}
            </div>
            <label className="filter-check"><input type="checkbox" checked={coveredOnly} onChange={(event) => setCoveredOnly(event.target.checked)} data-testid="tablet-filter-covered" /><span>{text.covered as string}</span></label>
            <label className="filter-check"><input type="checkbox" checked={evOnly} onChange={(event) => setEvOnly(event.target.checked)} data-testid="tablet-filter-ev" /><span>{text.ev as string}</span></label>
            <label className="filter-check"><input type="checkbox" checked={openNowOnly} onChange={(event) => setOpenNowOnly(event.target.checked)} data-testid="tablet-filter-open-now" /><span>{text.openNow as string}</span></label>
          </div>
        )}
        {selectedLot && (
          <article className="tablet-selected-lot" data-testid={`tablet-card-parking-lot-${selectedLot.id}`}>
            <div className="tablet-selected-heading">
              <span className={`tablet-status-dot tablet-status-dot--${statusFor(selectedLot)}`} />
              <div><span className="tablet-kicker">{statusLabel(statusFor(selectedLot), language)}</span><h2>{displayLotName(selectedLot)}</h2></div>
              <button type="button" aria-label={language === 'tr' ? 'Seçimi kaldır' : 'Clear selection'} onClick={() => setSelectedId(null)} data-testid={`tablet-button-close-lot-${selectedLot.id}`}><X size={18} /></button>
            </div>
            <div className="tablet-selected-facts">
              <div><strong>{selectedLot.free_spots}</strong><span>{text.spaces as string}</span></div>
              <div><strong>{distanceLabel(selectedLot, !!destination, language)}</strong><span>{text.distance as string}</span></div>
              <div><strong>{selectedLot.price_per_hour} ₺</strong><span>/ {text.priceUnit as string}</span></div>
            </div>
            <a className="tablet-navigate-button" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${selectedLot.lat},${selectedLot.lng}`)}`} target="_blank" rel="noopener noreferrer" data-testid={`tablet-link-navigate-${selectedLot.id}`}>
              <Navigation size={20} />{text.navigate as string}<ArrowUpRight size={18} />
            </a>
            <ParkingReportControls lotId={selectedLot.id} language={language} />
          </article>
        )}
        <div className="tablet-list" data-testid="tablet-parking-list">
          {isLoading && <div className="tablet-skeleton" role="status" data-testid="tablet-status-loading"><i /><span /><i /><span /></div>}
          {isError && <div className="tablet-empty" role="alert" data-testid="tablet-status-error"><strong>{text.errorTitle as string}</strong><p>{text.errorDescription as string}</p><button type="button" onClick={() => void refetch()} data-testid="tablet-button-retry">{text.retry as string}</button></div>}
          {!isLoading && !isError && lots?.length === 0 && <div className="tablet-empty" data-testid="tablet-status-empty"><strong>{text.emptyTitle as string}</strong><p>{text.emptyDescription as string}</p></div>}
          {!isLoading && !isError && lots && lots.length > 0 && visibleLots.length === 0 && <div className="tablet-empty"><strong>{text.noMatches as string}</strong><p>{language === 'tr' ? 'Aramanı veya filtreyi değiştirebilirsin.' : 'Try changing your search or filter.'}</p></div>}
          {!isLoading && visibleLots.map((lot) => (
            <button key={lot.id} type="button" className={`tablet-lot-row${selectedId === lot.id ? ' is-selected' : ''}`} onClick={() => selectLot(lot)} data-testid={`tablet-button-select-lot-${lot.id}`}>
              <span className={`tablet-row-status tablet-row-status--${statusFor(lot)}`}><CarFront size={19} /></span>
              <span className="tablet-row-copy"><strong>{displayLotName(lot)}</strong><span>{distanceLabel(lot, !!destination, language)} <i /> {statusLabel(statusFor(lot), language)}</span></span>
              <span className="tablet-row-spots"><strong>{lot.free_spots}</strong><small>{text.spaces as string}</small><em>{lot.price_per_hour} ₺ / {text.priceUnit as string}</em></span>
            </button>
          ))}
        </div>
      </aside>

      <section className="map-legend desktop-legend" aria-label={language === 'tr' ? 'Harita açıklaması' : 'Map legend'}>
        <span className="legend-item"><i className="legend-dot legend-dot--available" />{text.legendAvailable as string}</span>
        <span className="legend-item"><i className="legend-dot legend-dot--few" />{text.legendFew as string}</span>
        <span className="legend-item"><i className="legend-dot legend-dot--full" />{text.legendFull as string}</span>
        <span className="legend-item"><i className="legend-dot legend-dot--stale" />{text.legendStale as string}</span>
      </section>

      {!isLoading && !isError && (
        <div className="map-count desktop-count" data-testid="text-parking-count">
        {((text.lotCount as (count: number) => string)(visibleLots.length))}
        </div>
      )}

      {isLoading && (
        <section className="status-panel" role="status" data-testid="status-loading">
          <span className="status-symbol"><MapPin size={21} /></span>
          <h1 className="status-title">{text.loadingTitle as string}</h1>
          <p className="status-description">{text.loadingDescription as string}</p>
          <div className="loading-lines" aria-hidden="true">
            <span className="loading-line" /><span className="loading-line" />
          </div>
        </section>
      )}

      {isError && (
        <section className="status-panel" role="alert" data-testid="status-error">
          <span className="status-symbol"><AlertCircle size={21} /></span>
          <h1 className="status-title">{text.errorTitle as string}</h1>
          <p className="status-description">{text.errorDescription as string}</p>
          <button className="retry-button" type="button" onClick={() => void refetch()} data-testid="button-retry">
            {text.retry as string}
          </button>
        </section>
      )}

      {!isLoading && !isError && (lots?.length ?? 0) === 0 && (
        <section className="status-panel" role="status" data-testid="status-empty">
          <span className="status-symbol"><MapPin size={21} /></span>
          <h1 className="status-title">{text.emptyTitle as string}</h1>
          <p className="status-description">{text.emptyDescription as string}</p>
        </section>
      )}

      {selectedLot && (
        <article className="lot-card" data-testid={`card-parking-lot-${selectedLot.id}`}>
          <div className="card-topline">
            <div>
              <h2 data-testid={`text-lot-name-${selectedLot.id}`}>{displayLotName(selectedLot)}</h2>
              <div className="card-price">
                <strong>{selectedLot.price_per_hour}</strong> ₺ / {text.priceUnit as string}
              </div>
            </div>
            <div className={`availability-pill availability-pill--${statusFor(selectedLot)}`}>
              <span className="pill-dot" />
              {statusLabel(statusFor(selectedLot), language)}
            </div>
            <button
              className="close-card"
              type="button"
              aria-label={language === 'tr' ? 'Kartı kapat' : 'Close card'}
              data-testid={`button-close-lot-${selectedLot.id}`}
              onClick={() => setSelectedId(null)}
            ><X size={19} /></button>
          </div>
          <div className="card-metrics">
            <div className="metric">
              <span className="metric-icon"><CarFront size={18} /></span>
              <span className="metric-copy">
                <span className="metric-label">{selectedLot.free_spots === 1 ? text.spaceSingular as string : text.spaces as string}</span>
                <strong className="metric-value" data-testid={`text-free-spots-${selectedLot.id}`}>{selectedLot.free_spots}</strong>
              </span>
            </div>
            <div className="metric">
              <span className="metric-icon"><Clock3 size={18} /></span>
              <span className="metric-copy">
                <span className="metric-label">{language === 'tr' ? 'Son güncelleme' : 'Last updated'}</span>
                <strong className="metric-value" data-testid={`text-updated-${selectedLot.id}`}>{relativeUpdated(selectedLot.updated_at, language)}</strong>
              </span>
            </div>
          </div>
          <a
            className="navigate-button"
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${selectedLot.lat},${selectedLot.lng}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`link-navigate-${selectedLot.id}`}
          >
            <Navigation size={19} strokeWidth={2.5} />
            {text.navigate as string}
            <ArrowUpRight size={17} />
          </a>
          <ParkingReportControls lotId={selectedLot.id} language={language} />
        </article>
      )}

      <div className="mobile-top-controls">
        <div className="mobile-search-row">
          <ParkingSearch mobile search={search} onSearch={setSearch} onDistrict={selectDistrict} onLot={selectSearchLot}
            onDestination={selectDestination} onUseLocation={findNearMe} carMode={carMode} language={language} origin={searchOrigin} />
          <div className="language-toggle mobile-language" aria-label="Language">
            <button type="button" aria-pressed={language === 'tr'} data-testid="button-language-tr-mobile" onClick={() => setLanguage('tr')}>TR</button>
            <button type="button" aria-pressed={language === 'en'} data-testid="button-language-en-mobile" onClick={() => setLanguage('en')}>EN</button>
          </div>
        </div>
        <div className="mobile-brand-caption">Fatih Park <span>·</span> {text.subtitle as string}</div>
        {filterOpen && (
          <div className="filter-menu" role="group" aria-label={text.filters as string} data-testid="parking-filters">
            <div className="filter-group-title">{text.filters as string}</div>
            <div className="filter-status-options">
              {(Object.keys(filterLabels) as StatusFilter[]).map((value) => (
                <button key={value} type="button" className={`filter-option ${filter === value ? 'is-active' : ''}`} onClick={() => setFilter(value)} data-testid={`filter-${value}`}>
                  {value !== 'all' && <i className={`legend-dot legend-dot--${value === 'available' ? 'available' : value === 'few' ? 'few' : value === 'full' ? 'full' : 'stale'}`} />}
                  {filterLabels[value]}
                </button>
              ))}
            </div>
            <div className="filter-price">
              <div className="filter-group-title">{text.filterPriceTitle as string}</div>
              <div className="filter-price-row">
                <label className="filter-price-field">
                  <span>{text.minimumPrice as string}</span>
                  <input type="number" min="0" step="5" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} inputMode="decimal" />
                </label>
                <label className="filter-price-field">
                  <span>{text.maximumPrice as string}</span>
                  <input type="number" min="0" step="5" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} inputMode="decimal" />
                </label>
              </div>
              {priceRangeInvalid && <p className="filter-validation" role="alert">{text.priceRangeError as string}</p>}
            </div>
            <label className="filter-check">
              <input type="checkbox" checked={coveredOnly} onChange={(event) => setCoveredOnly(event.target.checked)} data-testid="filter-covered" />
              <span>{text.covered as string}</span>
            </label>
            <label className="filter-check">
              <input type="checkbox" checked={evOnly} onChange={(event) => setEvOnly(event.target.checked)} data-testid="filter-ev" />
              <span>{text.ev as string}</span>
            </label>
            <label className="filter-check">
              <input type="checkbox" checked={openNowOnly} onChange={(event) => setOpenNowOnly(event.target.checked)} data-testid="filter-open-now" />
              <span>{text.openNow as string}</span>
            </label>
          </div>
        )}
      </div>

      <div className="mobile-map-actions">
        <button className={`map-action ${(coveredOnly || evOnly || openNowOnly || priceMin !== '' || priceMax !== '' || filter !== 'all') ? 'is-filtered' : ''}`} type="button" onClick={() => setFilterOpen((open) => !open)} aria-label={text.filters as string} aria-expanded={filterOpen} data-testid="button-availability-filter"><SlidersHorizontal size={21} /></button>
      </div>

      <section className={`mobile-sheet mobile-sheet--${detent}`} aria-label={text.nearest as string} data-testid="mobile-parking-sheet">
        <button
          className="sheet-handle"
          type="button"
          aria-label={language === 'tr' ? 'Liste boyutunu değiştir' : 'Change list height'}
          onPointerDown={onHandlePointerDown}
          onPointerUp={onHandlePointerUp}
          data-testid="button-sheet-handle"
        ><span /></button>
        <div className="sheet-heading">
          <div>
            <div className="sheet-kicker">{destination ? nearbyTitle : language === 'tr' ? 'İSTANBUL' : 'ISTANBUL'}</div>
            <h1>{selectedLot ? displayLotName(selectedLot) : nearbyTitle}</h1>
          </div>
          <div className="sheet-count">{isLoading ? '—' : visibleLots.length}</div>
        </div>
        {walkingWarning && <div className="walking-warning" role="status">{walkingWarning}</div>}
        <button className="find-nearby-button" type="button" onClick={findNearMe} disabled={locationPending} data-testid="button-find-nearby">
          <LocateFixed size={19} />{locationPending ? text.locating as string : text.findNearMe as string}
        </button>
        {locationError && <div className="location-error location-error--sheet" role="status">{locationError}</div>}
        {selectedLot && (
          <article className="mobile-selected-lot" data-testid={`mobile-card-parking-lot-${selectedLot.id}`}>
            <div className="mobile-selected-head">
              <div className={`availability-pill availability-pill--${statusFor(selectedLot)}`}><span className="pill-dot" />{statusLabel(statusFor(selectedLot), language)}</div>
              <button className="mobile-close" type="button" aria-label={language === 'tr' ? 'Seçimi kaldır' : 'Clear selection'} onClick={() => setSelectedId(null)} data-testid="button-close-mobile-lot"><X size={18} /></button>
            </div>
            <div className="mobile-lot-price"><strong>{selectedLot.price_per_hour} ₺</strong> / {text.priceUnit as string}</div>
            <div className="mobile-lot-facts">
              <div><strong>{selectedLot.free_spots}</strong><span>{selectedLot.free_spots === 1 ? text.spaceSingular as string : text.spaces as string}</span></div>
              <div><strong>{relativeUpdated(selectedLot.updated_at, language)}</strong><span>{language === 'tr' ? 'Son güncelleme' : 'Last updated'}</span></div>
            </div>
            <div className="mobile-features">{selectedLot.is_covered && <span>{text.covered as string}</span>}{selectedLot.has_ev_charging && <span>{text.ev as string}</span>}</div>
            <a className="navigate-button" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${selectedLot.lat},${selectedLot.lng}`)}`} target="_blank" rel="noopener noreferrer" data-testid={`mobile-link-navigate-${selectedLot.id}`}>
              <Navigation size={19} strokeWidth={2.5} />{text.navigate as string}<ArrowUpRight size={17} />
            </a>
            <ParkingReportControls lotId={selectedLot.id} language={language} />
          </article>
        )}
        <div className="mobile-list-scroll">
          {isLoading && <div className="mobile-skeleton-list" role="status" data-testid="mobile-status-loading">{[0, 1, 2].map((item) => <div className="mobile-skeleton-row" key={item}><i /><span><b /><b /></span><em /></div>)}</div>}
          {isError && <div className="mobile-empty-state" role="alert" data-testid="mobile-status-error"><strong>{text.errorTitle as string}</strong><p>{text.errorDescription as string}</p><button className="mobile-retry" type="button" onClick={() => void refetch()} data-testid="mobile-button-retry">{text.retry as string}</button></div>}
          {!isLoading && !isError && lots?.length === 0 && <div className="mobile-empty-state" data-testid="mobile-status-empty"><strong>{text.emptyTitle as string}</strong><p>{text.emptyDescription as string}</p></div>}
          {!isLoading && !isError && lots && lots.length > 0 && visibleLots.length === 0 && <div className="mobile-empty-state"><strong>{text.noMatches as string}</strong><p>{language === 'tr' ? 'Aramanı veya filtreyi değiştirebilirsin.' : 'Try changing your search or filter.'}</p></div>}
          {!isLoading && visibleLots.map((lot, index) => (
            <button key={lot.id} type="button" className={`mobile-lot-row ${selectedId === lot.id ? 'is-selected' : ''}`} onClick={() => selectLot(lot)} data-testid={`button-select-lot-${lot.id}`}>
              <span className={`mobile-row-status mobile-row-status--${statusFor(lot)}`}><CarFront size={18} /></span>
               <span className="mobile-row-copy"><strong>{displayLotName(lot)}</strong><span>{distanceLabel(lot, !!destination, language)} <i /> {statusLabel(statusFor(lot), language)}</span></span>
              <span className="mobile-row-spots"><strong>{lot.free_spots}</strong><small>{text.spaces as string}</small></span>
            </button>
          ))}
          {!isLoading && !isError && visibleLots.length > 0 && <div className="sample-note">{text.subtitle as string}</div>}
        </div>
      </section>

      {locationConsentOpen && (
        <div className="location-consent-backdrop" onClick={() => setLocationConsentOpen(false)}>
          <section className="location-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="location-consent-title" onClick={(event) => event.stopPropagation()} data-testid="location-consent-dialog">
            <span className="location-consent-icon"><LocateFixed size={22} /></span>
            <h2 id="location-consent-title">{text.locationConsentTitle as string}</h2>
            <p>{text.locationConsentBody as string}</p>
            <div className="location-dialog-actions">
              <button type="button" className="location-cancel-button" onClick={() => setLocationConsentOpen(false)}>{text.locationConsentCancel as string}</button>
              <button type="button" className="location-continue-button" onClick={confirmLocationConsent} data-testid="button-confirm-location">{text.locationConsentContinue as string}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Home() {
  return <ParkingMap />;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
