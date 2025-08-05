import {
  ReplayNeedsQuotaAlert,
  useEnableNeedsQuotaAlert,
} from 'getsentry/components/replayNeedsQuotaAlert';

export default function ReplayListPageHeader() {
  const isEnabled = useEnableNeedsQuotaAlert();
  if (isEnabled) {
    return <ReplayNeedsQuotaAlert />;
  }

  return null;
}
