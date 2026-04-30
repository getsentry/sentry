import {t} from 'sentry/locale';

interface ExportDisabledTooltipOptions {
  isDataEmpty?: boolean;
  isDataError?: boolean;
  isDataLoading?: boolean;
}

export function getExportDisabledTooltip(props: ExportDisabledTooltipOptions) {
  if (props.isDataLoading) {
    return t('Loading...');
  }
  if (props.isDataError) {
    return t('Unable to export due to an error');
  }
  if (props.isDataEmpty) {
    return t('No data to export');
  }
  return;
}
