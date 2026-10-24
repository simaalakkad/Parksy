import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CircleMarker, MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  ArrowUpRight,
  CarFront,
  Clock3,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useListParkingLots, type ListParkingLotsParams, type ParkingLot } from '@workspace/api-client-react';
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
const FATIH_CENTER: [number, number] = [41.0186, 28.9397];
type Language = 'tr' | 'en';
type LotStatus = 'available' | 'few' | 'full' | 'stale';
type StatusFilter = 'all' | LotStatus;
type Detent = 'collapsed' | 'half' | 'full';

const copy = {
  tr: {
    subtitle: 'Fatih, İstanbul · Örnek otopark verileri',
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
    loadingDescription: 'Fatih çevresindeki boş yerleri getiriyoruz.',
    errorTitle: 'Otopark bilgisi alınamadı',
    errorDescription: 'Bağlantınızı kontrol edip yeniden deneyin.',
    retry: 'Yeniden dene',
    emptyTitle: 'Yakında otopark bulunamadı',
    emptyDescription: 'Şu anda Fatih için listelenecek otopark verisi yok.',
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
    subtitle: 'Fatih, Istanbul · Sample parking data',
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
    loadingDescription: 'Finding available spaces around Fatih.',
    errorTitle: 'Could not load parking',
    errorDescription: 'Check your connection and try again.',
    retry: 'Try again',
    emptyTitle: 'No nearby parking found',
    emptyDescription: 'There is no parking data to show for Fatih right now.',
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

function statusFor(lot: ParkingLot): LotStatus {
  if (getUpdatedMinutes(lot.updated_at) > 60) return 'stale';
  if (lot.free_spots <= 0) return 'full';
  return lot.free_spots >= Math.max(5, Math.ceil(lot.capacity * 0.2)) ? 'available' : 'few';
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
    const clusters: { center: [number, number]; lots: ParkingLot[] }[] = [];
    for (const lot of lots) {
      if (lot.id === selectedId) {
        clusters.push({ center: [lot.lat, lot.lng], lots: [lot] });
        continue;
      }
      const point = map.project([lot.lat, lot.lng], zoom);
      const match = clusters.find((cluster) => {
        if (cluster.lots[0].id === selectedId) return false;
        const center = map.project(cluster.center, zoom);
        return point.distanceTo(center) < 54;
      });
      if (match) {
        match.lots.push(lot);
        match.center = [
          match.lots.reduce((total, item) => total + item.lat, 0) / match.lots.length,
          match.lots.reduce((total, item) => total + item.lng, 0) / match.lots.length,
        ];
      } else {
        clusters.push({ center: [lot.lat, lot.lng], lots: [lot] });
      }
    }
    return clusters;
  }, [lots, map, revision, selectedId]);

  return (
    <>
      {groups.map((group) => {
        if (group.lots.length > 1) {
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
            title={`${lot.name}: ${lot.free_spots} free spots`}
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

function MapViewport({ target, selectedId }: { target: [number, number] | null; selectedId: number | null }) {
  const map = useMap();
  const lastTarget = useRef<string | null>(null);
  useEffect(() => {
    if (!target) return;
    const key = `${target[0].toFixed(5)},${target[1].toFixed(5)},${selectedId ?? ''}`;
    if (lastTarget.current === key) return;
    lastTarget.current = key;
    map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.55 });
  }, [map, target, selectedId]);
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
  const [viewportTarget, setViewportTarget] = useState<[number, number] | null>(null);
  const dragStart = useRef<number | null>(null);
  const [, setClock] = useState(0);
  const text = copy[language];
  const isDarkMap = useMapColorScheme();
  const minPriceValue = priceMin === '' ? undefined : Number(priceMin);
  const maxPriceValue = priceMax === '' ? undefined : Number(priceMax);
  const priceRangeInvalid = minPriceValue !== undefined && maxPriceValue !== undefined && minPriceValue > maxPriceValue;
  const queryParams = useMemo<ListParkingLotsParams>(() => {
    const params: ListParkingLotsParams = {};
    if (userPosition) {
      params.lat = userPosition[0];
      params.lng = userPosition[1];
    }
    if (!priceRangeInvalid && minPriceValue !== undefined) params.price_min = minPriceValue;
    if (!priceRangeInvalid && maxPriceValue !== undefined) params.price_max = maxPriceValue;
    if (coveredOnly) params.covered = true;
    if (evOnly) params.ev_charging = true;
    if (openNowOnly) params.open_now = true;
    return params;
  }, [userPosition, minPriceValue, maxPriceValue, priceRangeInvalid, coveredOnly, evOnly, openNowOnly]);
  const { data: lots, isLoading, isError, refetch } = useListParkingLots(queryParams);
  const visibleLots = useMemo(() => (lots ?? [])
    .filter((lot) => lot.name.toLocaleLowerCase(language === 'tr' ? 'tr-TR' : 'en').includes(search.trim().toLocaleLowerCase(language === 'tr' ? 'tr-TR' : 'en')))
    .filter((lot) => filter === 'all' || statusFor(lot) === filter), [lots, language, search, filter]);
  const selectedLot = visibleLots.find((lot) => lot.id === selectedId);
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

  const selectLot = (lot: ParkingLot) => {
    setSelectedId(lot.id);
    setViewportTarget([lot.lat, lot.lng]);
    setDetent('full');
  };

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
    const timer = window.setInterval(() => setClock((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className={`park-app${carMode ? ' car-mode' : ''}`} data-testid="screen-parking-map">
      <div className="park-map" data-testid="map-fatih">
        <MapContainer
          className={isDarkMap ? 'leaflet-map--dark' : undefined}
          center={FATIH_CENTER}
          zoom={15}
          minZoom={12}
          maxZoom={19}
          zoomControl={false}
          scrollWheelZoom
          attributionControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewport target={viewportTarget} selectedId={selectedId} />
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
        </MapContainer>
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
        <button className="drive-mode-toggle" type="button" aria-pressed={carMode} onClick={() => setCarMode((value) => !value)} data-testid="button-toggle-car-mode">
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

      <aside className="tablet-panel" aria-label={text.nearest as string} data-testid="tablet-parking-panel">
        <div className="tablet-panel-heading">
          <div className="tablet-panel-title">
            <span className="tablet-kicker">{language === 'tr' ? 'FATİH · İSTANBUL' : 'FATIH · ISTANBUL'}</span>
            <h1>{text.nearest as string}</h1>
          </div>
          <span className="tablet-result-count" data-testid="tablet-text-parking-count">{isLoading ? '—' : visibleLots.length}</span>
        </div>
        <div className="tablet-search">
          <Search size={19} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.searchPlaceholder as string} aria-label={text.searchPlaceholder as string} data-testid="tablet-input-parking-search" />
          {search && <button type="button" aria-label={text.clearSearch as string} onClick={() => setSearch('')} data-testid="tablet-button-clear-search"><X size={17} /></button>}
        </div>
        <div className="tablet-tools">
          <button className="tablet-location-button" type="button" onClick={findNearMe} disabled={locationPending} data-testid="tablet-button-find-nearby">
            <LocateFixed size={18} />{locationPending ? text.locating as string : text.findNearMe as string}
          </button>
          <button className={`tablet-filter-button${filterOpen ? ' is-open' : ''}`} type="button" onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen} data-testid="tablet-button-filters">
            <SlidersHorizontal size={18} />{text.filters as string}
          </button>
        </div>
        {locationError && <div className="tablet-location-error" role="status">{locationError}</div>}
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
              <div><span className="tablet-kicker">{statusLabel(statusFor(selectedLot), language)}</span><h2>{selectedLot.name}</h2></div>
              <button type="button" aria-label={language === 'tr' ? 'Seçimi kaldır' : 'Clear selection'} onClick={() => setSelectedId(null)} data-testid={`tablet-button-close-lot-${selectedLot.id}`}><X size={18} /></button>
            </div>
            <div className="tablet-selected-facts">
              <div><strong>{selectedLot.free_spots}</strong><span>{text.spaces as string}</span></div>
              <div><strong>{selectedLot.distance_km?.toFixed(1) ?? '—'} km</strong><span>{text.distance as string}</span></div>
              <div><strong>{selectedLot.price_per_hour} ₺</strong><span>/ {text.priceUnit as string}</span></div>
            </div>
            <a className="tablet-navigate-button" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${selectedLot.lat},${selectedLot.lng}`)}`} target="_blank" rel="noopener noreferrer" data-testid={`tablet-link-navigate-${selectedLot.id}`}>
              <Navigation size={20} />{text.navigate as string}<ArrowUpRight size={18} />
            </a>
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
              <span className="tablet-row-copy"><strong>{lot.name}</strong><span>{lot.distance_km?.toFixed(1) ?? '—'} km <i /> {statusLabel(statusFor(lot), language)}</span></span>
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
              <h2 data-testid={`text-lot-name-${selectedLot.id}`}>{selectedLot.name}</h2>
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
        </article>
      )}

      <div className="mobile-top-controls">
        <div className="mobile-search-row">
          <div className="mobile-search">
            <Search size={20} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={text.searchPlaceholder as string}
              aria-label={text.searchPlaceholder as string}
              data-testid="input-parking-search"
            />
            {search && <button type="button" aria-label={text.clearSearch as string} onClick={() => setSearch('')} data-testid="button-clear-search"><X size={17} /></button>}
          </div>
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
            <div className="sheet-kicker">{language === 'tr' ? 'FATİH' : 'FATIH'}</div>
            <h1>{selectedLot ? selectedLot.name : text.nearest as string}</h1>
          </div>
          <div className="sheet-count">{isLoading ? '—' : visibleLots.length}</div>
        </div>
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
               <span className="mobile-row-copy"><strong>{lot.name}</strong><span>{lot.distance_km?.toFixed(1) ?? '—'} km <i /> {statusLabel(statusFor(lot), language)}</span></span>
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
