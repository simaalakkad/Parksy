import { useEffect, useState } from 'react';
import { ChevronDown, MapPin, Search, X, CarFront, Building2, Landmark, History, LocateFixed, Mic } from 'lucide-react';
import { useListDistricts, useSearchParkingLots, getSearchParkingLotsQueryKey, useSearchPlaces, getSearchPlacesQueryKey, type District, type ParkingLot, type GeographicPlace } from '@workspace/api-client-react';
import { useRecentSearches, type RecentSearch } from '@/lib/recent-searches';
import { useVoiceSearch } from '@/lib/use-voice-search';

function normalize(value: string) {
  return value.replace(/İ/g, 'I').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function ParkingSearch({ search, onSearch, onDistrict, onLot, onDestination, onUseLocation, carMode = false, language, origin, mobile = false }: {
  search: string;
  onSearch: (value: string) => void;
  onDistrict: (district: District) => void;
  onLot: (lot: ParkingLot) => void;
  onDestination: (place: GeographicPlace) => void;
  onUseLocation: () => void;
  carMode?: boolean;
  language: 'tr' | 'en';
  origin: [number, number];
  mobile?: boolean;
}) {
  const tr = language === 'tr';
  const [districtOpen, setDistrictOpen] = useState(false);
  const [districtSearch, setDistrictSearch] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [online, setOnline] = useState(navigator.onLine);
  const history = useRecentSearches();
  const voice = useVoiceSearch(language, (value) => { onSearch(value); setSuggestionsOpen(true); setDistrictOpen(false); });
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const districts = useListDistricts();
  const params = { q: debouncedSearch, lat: origin[0], lng: origin[1] };
  const matches = useSearchParkingLots(params, {
    query: { queryKey: getSearchParkingLotsQueryKey(params), enabled: online && debouncedSearch.length >= 3, retry: false },
  });
  const placeParams = { q: debouncedSearch, language };
  const places = useSearchPlaces(placeParams, {
    query: { queryKey: getSearchPlacesQueryKey(placeParams), enabled: online && debouncedSearch.length >= 3, retry: false, staleTime: 300_000 },
  });
  const districtMatches = (districts.data ?? []).filter((d) =>
    normalize(`${d.name_tr} ${d.name_en}`).includes(normalize(districtOpen ? districtSearch : search.trim())));
  const chooseDistrict = (district: District) => {
    history.save({ id: `district:${district.id}`, kind: 'destination', name: tr ? district.name_tr : district.name_en,
      label: tr ? 'İlçe · İstanbul' : 'District · Istanbul', place: {
        id: `district:${district.id}`, kind: 'district', name: tr ? district.name_tr : district.name_en,
        label: 'İstanbul', lat: district.center_lat, lng: district.center_lng,
      } });
    setDistrictOpen(false); setSuggestionsOpen(false); setDistrictSearch(''); onSearch(''); onDistrict(district);
  };
  const choose = (result: RecentSearch) => {
    history.save(result); setSuggestionsOpen(false); setDistrictOpen(false); onSearch('');
    if (result.kind === 'parking') onLot(result.lot);
    else onDestination(result.place);
  };
  const resultGroups: { title: string; items: RecentSearch[] }[] = [
    { title: tr ? 'Otoparklar' : 'Parking lots', items: (matches.data ?? []).map((lot) => ({
      id: `lot:${lot.id}`, kind: 'parking', name: `${lot.name}${lot.is_demo ? ' · DEMO' : ''}`,
      label: `${lot.neighborhood} · ${tr ? lot.district_name_tr : lot.district_name_en}`, lot,
    })) },
    { title: tr ? 'İlçeler ve mahalleler' : 'Districts and neighborhoods', items: (places.data?.areas ?? []).map((place) => ({
      id: place.id, kind: 'destination', name: place.name, label: place.label, place,
    })) },
    { title: tr ? 'Yerler' : 'Places', items: (places.data?.places ?? []).map((place) => ({
      id: place.id, kind: 'destination', name: place.name, label: place.label, place,
    })) },
  ];
  let remaining = carMode ? 3 : 30;
  const limitedGroups = resultGroups.map((group) => {
    const items = group.items.slice(0, remaining);
    remaining -= items.length;
    return { ...group, items };
  });
  const resultCount = limitedGroups.reduce((count, group) => count + group.items.length, 0);
  const pending = debouncedSearch !== search.trim() || matches.isFetching || places.isFetching;
  const resultButton = (result: RecentSearch, recent = false) => <button type="button" key={result.id}
    onClick={() => choose(result)} data-testid={`place-result-${result.id}`}>
    <span className="search-result-icon">{recent ? <History size={20} /> : result.kind === 'parking'
      ? <CarFront size={20} /> : result.place.kind === 'place' ? <Landmark size={20} /> : <Building2 size={20} />}</span>
    <span><strong>{result.name}</strong><small>{result.label}</small></span>
  </button>;
  return <div className={`parking-search ${mobile ? 'mobile-search' : 'tablet-search'}`}
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) { setSuggestionsOpen(false); setDistrictOpen(false); }
    }}>
    <Search size={mobile ? 20 : 19} aria-hidden="true" />
    <input type="search" value={search}
      onChange={(event) => { onSearch(event.target.value); setSuggestionsOpen(true); setDistrictOpen(false); }}
      onFocus={() => setSuggestionsOpen(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { setSuggestionsOpen(false); setDistrictOpen(false); }
        if (event.key === 'Enter' && search.trim() && limitedGroups.flatMap((group) => group.items)[0]) {
          event.preventDefault(); choose(limitedGroups.flatMap((group) => group.items)[0]);
        }
      }}
      placeholder={tr ? 'Yer, otopark, ilçe ara' : 'Search places, parking, districts'}
      aria-label={tr ? 'Yer, adres, otopark, ilçe veya mahalle ara' : 'Search places, addresses, parking, districts or neighborhoods'}
      data-testid={mobile ? 'input-parking-search' : 'tablet-input-parking-search'} />
    {search && <button type="button" aria-label={tr ? 'Aramayı temizle' : 'Clear search'}
      onClick={() => { onSearch(''); setSuggestionsOpen(false); }}><X size={17} /></button>}
    {carMode && voice.available && <button type="button" className={`voice-search-button${voice.listening ? ' is-listening' : ''}`}
      aria-label={tr ? 'Sesli arama' : 'Voice search'} aria-pressed={voice.listening}
      onClick={() => { setSuggestionsOpen(true); voice.toggle(); }} data-testid="button-voice-search"><Mic size={26} /></button>}
    <button type="button" className="district-picker-trigger" aria-expanded={districtOpen}
      aria-label={tr ? 'İlçe seç' : 'Choose district'} title={tr ? 'İlçeler' : 'Districts'}
      data-testid={mobile ? 'district-picker-mobile' : 'district-picker-tablet'}
      onClick={() => { setDistrictOpen((v) => !v); setSuggestionsOpen(false); }}>
      <MapPin size={18} /><ChevronDown size={13} />
    </button>
    {(districtOpen || suggestionsOpen) &&
      <div className="parking-search-results" aria-label={tr ? 'Arama sonuçları' : 'Search results'}
        onKeyDown={(event) => { if (event.key === 'Escape') { setDistrictOpen(false); setSuggestionsOpen(false); } }}>
        {districtOpen && <input type="search" className="district-search-input" value={districtSearch}
          onChange={(event) => setDistrictSearch(event.target.value)}
          placeholder={tr ? 'İlçe adı' : 'District name'} aria-label={tr ? 'İlçe adı' : 'District name'} />}
        {!districtOpen && <button className="use-location-suggestion" type="button" onClick={() => {
          setSuggestionsOpen(false); onSearch(''); onUseLocation();
        }}><LocateFixed size={22} /><strong>{tr ? 'Şu anki konumumu kullan' : 'Use my current location'}</strong></button>}
        {districtOpen && districts.isLoading && <p role="status">{tr ? 'İlçeler yükleniyor…' : 'Loading districts…'}</p>}
        {districtOpen && districts.isError && <p role="alert">{tr ? 'İlçeler yüklenemedi.' : 'Could not load districts.'}</p>}
        {districtOpen && districtMatches.map((d) => <button type="button" key={d.id} onClick={() => chooseDistrict(d)} data-testid={`district-option-${d.id}`}>
          <Building2 size={20} /><span><strong>{tr ? d.name_tr : d.name_en}</strong><small>{tr ? 'İlçe · İstanbul' : 'District · Istanbul'}</small></span>
        </button>)}
        {!districtOpen && !search.trim() && history.recent.length > 0 && <>
          <div className="search-section-heading"><h3>{tr ? 'Son aramalar' : 'Recent'}</h3>
            <button type="button" onClick={history.clear}>{tr ? 'Geçmişi temizle' : 'Clear history'}</button></div>
          {history.recent.slice(0, carMode ? 3 : 5).map((result) => resultButton(result, true))}
        </>}
        {!districtOpen && search.trim().length >= 3 && limitedGroups.map((group) => group.items.length > 0 &&
          <section key={group.title}><h3 className="search-section-label">{group.title}</h3>{group.items.map((result) => resultButton(result))}</section>)}
        {!districtOpen && search.trim().length > 0 && search.trim().length < 3 && <p>{tr ? 'En az 3 karakter yazın.' : 'Enter at least 3 characters.'}</p>}
        {!districtOpen && pending && online && search.trim().length >= 3 && <p role="status">{tr ? 'Aranıyor…' : 'Searching…'}</p>}
        {!online && <p role="alert">{tr ? 'İnternet bağlantısı yok. Bağlanınca tekrar deneyin.' : 'You are offline. Reconnect and try again.'}</p>}
        {!districtOpen && online && (places.isError || matches.isError || places.data?.geocoding_error) &&
          <div role="alert"><p>{tr ? 'Yer arama servisine ulaşılamıyor. Mevcut yerel sonuçları kullanabilir veya tekrar deneyebilirsiniz.' : 'Place search is unavailable. Use the local results or try again.'}</p>
            <button className="search-retry-button" type="button" onClick={() => { void places.refetch(); void matches.refetch(); }}>
              {tr ? 'Tekrar dene' : 'Try again'}
            </button></div>}
        {voice.listening && <p role="status">{tr ? 'Dinleniyor…' : 'Listening…'}</p>}
        {voice.error && <p role="alert">{voice.error}</p>}
        {(districtOpen && !districts.isLoading && !districtMatches.length
          || !districtOpen && online && search.trim().length >= 3 && !pending && !resultCount && !places.data?.geocoding_error && !places.isError && !matches.isError) &&
          <p>{tr ? 'Sonuç bulunamadı.' : 'No results found.'}</p>}
        {!districtOpen && <div className="search-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · <a href="https://photon.komoot.io" target="_blank" rel="noreferrer">Photon</a></div>}
      </div>}
  </div>;
}
