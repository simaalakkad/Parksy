import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX } from 'lucide-react';
import {
  useGetLotReportingStatus, useCreateParkingReport,
  getGetLotReportingStatusQueryKey, getListParkingLotsQueryKey, getSearchParkingLotsQueryKey,
  type LotReportingState,
} from '@workspace/api-client-react';

export function ParkingReportControls({ lotId, language }: { lotId: number; language: 'tr' | 'en' }) {
  const tr = language === 'tr';
  const client = useQueryClient();
  const state = useGetLotReportingStatus(lotId, { query: { queryKey: getGetLotReportingStatusQueryKey(lotId), refetchInterval: 30_000, retry: false } });
  const [clock, setClock] = useState(Date.now);
  const [message, setMessage] = useState('');
  const serverOffset = useMemo(() => state.data ? Date.parse(state.data.server_time) - Date.now() : 0, [state.data?.server_time]);
  const remaining = state.data?.next_allowed_at
    ? Math.max(0, Math.ceil((Date.parse(state.data.next_allowed_at) - (clock + serverOffset)) / 1000)) : 0;
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { setMessage(''); }, [lotId, language]);
  const mutation = useCreateParkingReport({ mutation: {
    onSuccess: (data) => {
      client.setQueryData(getGetLotReportingStatusQueryKey(lotId), data);
      setClock(Date.now());
      setMessage(tr ? 'Teşekkürler, bildirimin kaydedildi.' : 'Thanks, your report was saved.');
      void client.invalidateQueries({ queryKey: getListParkingLotsQueryKey() });
      void client.invalidateQueries({ queryKey: getSearchParkingLotsQueryKey() });
    },
    onError: (error) => {
      const status = typeof error === 'object' && error && 'status' in error ? error.status : undefined;
      if (status === 429 && 'data' in error && error.data) {
        client.setQueryData(getGetLotReportingStatusQueryKey(lotId), error.data as LotReportingState);
        setMessage(tr ? 'Bu otopark için 10 dakikada bir bildirim yapabilirsin.' : 'You can report this lot once every 10 minutes.');
      } else {
        setMessage(status === 403
          ? (tr ? 'Bildirim için tarayıcı çerezlerini etkinleştirip tekrar dene.' : 'Enable browser cookies and try again to report.')
          : (tr ? 'Bildirim gönderilemedi. Bağlantını kontrol edip tekrar dene.' : 'Report could not be sent. Check your connection and try again.'));
      }
      void state.refetch();
    },
  } });
  const disabled = !state.data || state.isError || mutation.isPending || remaining > 0;
  return <section className="parking-report-controls" aria-label={tr ? 'Yer durumunu bildir' : 'Report availability'}>
    <p className="report-reminder">{tr ? 'Lütfen yalnızca park ettiğinizde bildirin.' : 'Please report only when you are parked.'}</p>
    <div className="report-buttons">
      <button type="button" disabled={disabled} className="report-available"
        data-testid={`report-available-${lotId}`} onClick={() => mutation.mutate({ lotId, data: { status: 'available' } })}>
        <CircleCheck size={20} /><span>{tr ? 'Yer var' : 'Spot available'}</span>
      </button>
      <button type="button" disabled={disabled} className="report-full"
        data-testid={`report-full-${lotId}`} onClick={() => mutation.mutate({ lotId, data: { status: 'full' } })}>
        <CircleX size={20} /><span>{tr ? 'Dolu' : 'Full'}</span>
      </button>
    </div>
    <div className="report-feedback" role="status" aria-live="polite">
      {mutation.isPending ? (tr ? 'Gönderiliyor…' : 'Sending…') : message}
      {remaining > 0 && <span>{tr ? 'Tekrar bildirim: ' : 'Report again in '}{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
    </div>
    {state.isError && <div className="report-error" role="alert">
      <span>{tr ? 'Bildirim bilgisi yüklenemedi.' : 'Reporting is temporarily unavailable.'}</span>
      <button type="button" onClick={() => void state.refetch()}>{tr ? 'Tekrar dene' : 'Try again'}</button>
    </div>}
    {!!state.data?.recent_report_count && <p className="report-source-note">{tr
      ? `${state.data.recent_report_count} güncel bildirim renge yansıtıldı. Yer sayısı işletme verisidir.`
      : `${state.data.recent_report_count} recent reports inform the color. Spot counts are lot data.`}</p>}
  </section>;
}
