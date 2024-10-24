import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DatasetSource} from 'sentry/utils/discover/types';
import {type Widget, WidgetType} from 'sentry/views/dashboards/types';

interface DiscoverSplitAlertProps {
  widget: Widget;
  onSetTransactionsDataset?: () => void;
}

export function DiscoverSplitAlert({
  widget,
  onSetTransactionsDataset,
}: DiscoverSplitAlertProps) {
  if (
    widget?.datasetSource !== DatasetSource.FORCED ||
    widget.widgetType !== WidgetType.ERRORS
  ) {
    return null;
  }

  return (
    <Tooltip
      containerDisplayMode="inline-flex"
      isHoverable
      title={tct(
        "We're splitting our datasets up to make it a bit easier to digest. We defaulted this widget to Errors. [editText]",
        {
          editText: onSetTransactionsDataset ? (
            <a
              onClick={() => {
                onSetTransactionsDataset();
              }}
            >
              {t('Switch to Transactions')}
            </a>
          ) : (
            t('Edit as you see fit.')
          ),
        }
      )}
    >
      <IconWarning color="warningText" aria-label={t('Dataset split warning')} />
    </Tooltip>
  );
}
