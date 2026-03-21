import {Tag} from '@sentry/scraps/badge';

const STATUS_CONFIG: Record<string, {label: string; variant: string}> = {
  pending: {label: 'Pending', variant: 'default'},
  needs_info: {label: 'Needs Info', variant: 'warning'},
  accepted: {label: 'Accepted', variant: 'success'},
  rejected: {label: 'Rejected', variant: 'danger'},
  duplicate: {label: 'Duplicate', variant: 'default'},
};

interface StartupStatusBadgeProps {
  status: string;
}

export function StartupStatusBadge({status}: StartupStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {label: status, variant: 'default'};
  return <Tag variant={config.variant as any}>{config.label}</Tag>;
}
