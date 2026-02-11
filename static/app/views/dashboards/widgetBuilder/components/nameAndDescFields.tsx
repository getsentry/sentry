import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {TextArea} from '@sentry/scraps/textarea';

import TextField from 'sentry/components/forms/fields/textField';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

interface WidgetBuilderNameAndDescriptionProps {
  error?: Record<string, any>;
  setError?: (error: Record<string, any>) => void;
}

function WidgetBuilderNameAndDescription({
  error,
  setError,
}: WidgetBuilderNameAndDescriptionProps) {
  const organization = useOrganization();
  const {state, dispatch} = useWidgetBuilderContext();
  const [isDescSelected, setIsDescSelected] = useState(state.description ? true : false);
  const isEditing = useIsEditingWidget();
  const source = useDashboardWidgetSource();

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
      {!isDescSelected && (
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
      {isDescSelected && (
        <TextArea
          autoComplete="off"
          placeholder={t('Description')}
          aria-label={t('Description')}
          autosize
          rows={4}
          value={state.description}
          onChange={e => {
            dispatch(
              {type: BuilderStateAction.SET_DESCRIPTION, payload: e.target.value},
              {updateUrl: false}
            );
          }}
          onBlur={e => {
            dispatch(
              {
                type: BuilderStateAction.SET_DESCRIPTION,
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
      )}
    </Fragment>
  );
}

export default WidgetBuilderNameAndDescription;

const StyledTextField = styled(TextField)`
  margin-bottom: ${space(1)};
  padding: 0;
  border: none;
`;
