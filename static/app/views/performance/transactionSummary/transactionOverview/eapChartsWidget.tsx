import {t} from 'sentry/locale';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';

export function EAPChartsWidget() {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Duration Breakdown')} />}
      Actions={
        <Widget.WidgetToolbar>
          <Widget.WidgetDescription
            title={t('Duration Breakdown')}
            description={t(
              'Duration Breakdown reflects transaction durations by percentile over time.'
            )}
          />
        </Widget.WidgetToolbar>
      }
      Visualization={null}
      Footer={null}
    />
  );
}
