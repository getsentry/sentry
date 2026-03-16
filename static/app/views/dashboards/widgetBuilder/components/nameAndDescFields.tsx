import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import TextField from 'sentry/components/forms/fields/textField';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DisplayType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {WidgetBuilderDescriptionField} from 'sentry/views/dashboards/widgetBuilder/components/descriptionField';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useDashboardWidgetSource} from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import {useIsEditingWidget} from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

interface WidgetBuilderNameAndDescriptionProps {
  error?: Record<string, any>;
  setError?: (error: Record<string, any>) => void;
}

export function WidgetBuilderNameAndDescription({
  error,
  setError,
}: WidgetBuilderNameAndDescriptionProps) {
  const organization = useOrganization();
  const {state, dispatch} = useWidgetBuilderContext();
  const [isDescSelected, setIsDescSelected] = useState(state.description ? true : false);
  const isEditing = useIsEditingWidget();
  const source = useDashboardWidgetSource();
  const isTextWidget = state.displayType === DisplayType.TEXT;

  return (
    <Fragment>
      <SectionHeader
        title={t('Display Name')}
        tooltipText={t('This will appear in the header of your widget.')}
      />
      <StyledTextField
        autoComplete="off"
        name="widget-name"
        size="md"
        placeholder={t('Name')}
        title={t('Name')}
        aria-label={t('Name')}
        value={state.title}
        onChange={(newTitle: any) => {
          // clear error once user starts typing
          if (error?.title) {
            setError?.({...error, title: undefined});
          }
          dispatch(
            {type: BuilderStateAction.SET_TITLE, payload: newTitle},
            {updateUrl: false}
          );
        }}
        onBlur={value => {
          dispatch(
            {type: BuilderStateAction.SET_TITLE, payload: value},
            {updateUrl: true}
          );
          trackAnalytics('dashboards_views.widget_builder.change', {
            from: source,
            widget_type: state.dataset ?? '',
            builder_version: WidgetBuilderVersion.SLIDEOUT,
            field: 'title',
            value: '',
            new_widget: !isEditing,
            organization,
          });
        }}
        required
        error={error?.title}
        inline={false}
      />
      {!isTextWidget && !isDescSelected && (
        <Button
          priority="link"
          aria-label={t('Add Description')}
          onClick={() => {
            setIsDescSelected(true);
          }}
          data-test-id="add-description"
        >
          {t('+ Add Description')}
        </Button>
      )}
      {!isTextWidget && isDescSelected && <WidgetBuilderDescriptionField rows={4} />}
    </Fragment>
  );
}

const StyledTextField = styled(TextField)`
  margin-bottom: ${p => p.theme.space.md};
  padding: 0;
  border: none;
`;
