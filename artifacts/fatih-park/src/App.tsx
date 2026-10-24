import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  ArrowUpRight,
  CarFront,
  Clock3,
  MapPin,
  Navigation,
  X,
} from 'lucide-react';
import { useListParkingLots, type ParkingLot } from '@workspace/api-client-react';
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
    className: `lot-pin lot-pin--${status}${selected ? ' lot-pin--selected' : ''}`,
    html: `<span class="lot-pin__body"><span class="lot-pin__number">${Math.max(0, lot.free_spots)}</span></span>`,
    iconSize: [48, 48],
    iconAnchor: [20, 38],
  });
  return icon;
}

function MapTapHandler({ onMapTap }: { onMapTap: () => void }) {
  useMapEvents({ click: onMapTap });
  return null;
}

function ParkingMap() {
  const { data: lots, isLoading, isError, refetch } = useListParkingLots();
  const [language, setLanguage] = useState<Language>('tr');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [, setClock] = useState(0);
  const text = copy[language];
  const selectedLot = lots?.find((lot) => lot.id === selectedId);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="park-app" data-testid="screen-parking-map">
      <div className="park-map" data-testid="map-fatih">
        <MapContainer
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
          <ZoomControl position="bottomright" />
          <MapTapHandler onMapTap={() => setSelectedId(null)} />
          {lots?.map((lot) => (
            <Marker
              key={lot.id}
              position={[lot.lat, lot.lng]}
              icon={makeLotIcon(lot, selectedId === lot.id)}
              eventHandlers={{ click: () => setSelectedId(lot.id) }}
              title={`${lot.name}: ${lot.free_spots} ${text.spaces}`}
            />
          ))}
        </MapContainer>
      </div>

      <header className="topbar">
        <div className="brand-panel">
          <div className="brand-line">
            <span className="brand-mark"><CarFront size={19} strokeWidth={2.5} /></span>
            <span className="brand-name">Fatih Park</span>
          </div>
          <p className="brand-subtitle">{text.subtitle as string}</p>
        </div>
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

      <section className="map-legend" aria-label={language === 'tr' ? 'Harita açıklaması' : 'Map legend'}>
        <span className="legend-item"><i className="legend-dot legend-dot--available" />{text.legendAvailable as string}</span>
        <span className="legend-item"><i className="legend-dot legend-dot--few" />{text.legendFew as string}</span>
        <span className="legend-item"><i className="legend-dot legend-dot--full" />{text.legendFull as string}</span>
        <span className="legend-item"><i className="legend-dot legend-dot--stale" />{text.legendStale as string}</span>
      </section>

      {!isLoading && !isError && (
        <div className="map-count" data-testid="text-parking-count">
          {((text.lotCount as (count: number) => string)(lots?.length ?? 0))}
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
