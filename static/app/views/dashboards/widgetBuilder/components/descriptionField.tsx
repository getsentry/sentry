import {TextArea} from '@sentry/scraps/textarea';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DisplayType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useDashboardWidgetSource} from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import {useIsEditingWidget} from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

interface WidgetBuilderDescriptionFieldProps {
  autosize?: boolean;
  placeholder?: string;
  rows?: number;
}

export function WidgetBuilderDescriptionField({
  rows = 4,
  placeholder = t('Description'),
  autosize = true,
}: WidgetBuilderDescriptionFieldProps) {
  const organization = useOrganization();
  const {state, dispatch} = useWidgetBuilderContext();
  const isEditing = useIsEditingWidget();
  const source = useDashboardWidgetSource();
  const isTextWidget = state.displayType === DisplayType.TEXT;
  const textValue = isTextWidget ? state.textContent : state.description;
  const builderStateAction = isTextWidget
    ? BuilderStateAction.SET_TEXT_CONTENT
    : BuilderStateAction.SET_DESCRIPTION;

  return (
    <TextArea
      autoComplete="off"
      placeholder={placeholder}
      aria-label={placeholder}
      autosize={autosize}
      rows={rows}
      value={textValue}
      onChange={e => {
        dispatch({type: builderStateAction, payload: e.target.value}, {updateUrl: false});
      }}
      onBlur={e => {
        dispatch(
          {
            type: builderStateAction,
            payload: e.target.value,
          },
          {updateUrl: true}
        );
        trackAnalytics('dashboards_views.widget_builder.change', {
          from: source,
          widget_type: state.dataset ?? '',
          builder_version: WidgetBuilderVersion.SLIDEOUT,
          field: 'description',
          value: '',
          new_widget: !isEditing,
          organization,
        });
      }}
    />
  );
}
