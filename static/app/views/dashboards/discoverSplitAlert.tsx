import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DatasetSource} from 'sentry/utils/discover/types';
import type {Widget} from 'sentry/views/dashboards/types';

interface DiscoverSplitAlertProps {
  widget: Widget;
}

export function DiscoverSplitAlert({widget}: DiscoverSplitAlertProps) {
  if (widget?.datasetSource !== DatasetSource.FORCED) {
    return null;
  }

  return (
    <Tooltip
      containerDisplayMode="inline-flex"
      title={t(
        "We're splitting our datasets up to make it a bit easier to digest. We defaulted this widget to Errors. Edit as you see fit."
      )}
    >
      <IconWarning color="warningText" aria-label={t('Dataset split warning')} />
    </Tooltip>
  );
}
