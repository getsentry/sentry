import {Fragment} from 'react';
import styled from '@emotion/styled';

import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {IconGraph, IconNumber, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

const typeIcons = {
  [DisplayType.AREA]: <IconGraph key="area" type="area" />,
  [DisplayType.BAR]: <IconGraph key="bar" type="bar" />,
  [DisplayType.LINE]: <IconGraph key="line" type="line" />,
  [DisplayType.TABLE]: <IconTable key="table" />,
  [DisplayType.BIG_NUMBER]: <IconNumber key="number" />,
};

const displayTypes = {
  [DisplayType.AREA]: t('Area'),
  [DisplayType.BAR]: t('Bar'),
  [DisplayType.LINE]: t('Line'),
  [DisplayType.TABLE]: t('Table'),
  [DisplayType.BIG_NUMBER]: t('Big Number'),
};

interface WidgetBuilderTypeSelectorProps {
  error?: Record<string, any>;
  setError?: (error: Record<string, any>) => void;
}

function WidgetBuilderTypeSelector({error, setError}: WidgetBuilderTypeSelectorProps) {
  const {state, dispatch} = useWidgetBuilderContext();
  const config = getDatasetConfig(state.dataset);
  const source = useDashboardWidgetSource();
  const isEditing = useIsEditingWidget();
  const organization = useOrganization();

  return (
    <Fragment>
      <SectionHeader
        tooltipText={t('This is the type of visualization (ex. line chart)')}
        title={t('Type')}
      />
      <StyledFieldGroup
        error={error?.displayType}
        inline={false}
        flexibleControlStateSize
      >
        <SelectControl
          name="displayType"
          value={state.displayType}
          options={Object.keys(displayTypes).map(value => ({
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            leadingItems: typeIcons[value],
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            label: displayTypes[value],
            value,
            disabled: !config.supportedDisplayTypes.includes(value as DisplayType),
          }))}
          clearable={false}
          onChange={(newValue: any) => {
            if (newValue?.value === state.displayType) {
              return;
            }
            setError?.({...error, displayType: undefined});

            dispatch({
              type: BuilderStateAction.SET_DISPLAY_TYPE,
              payload: newValue?.value,
            });
            if (
              (newValue.value === DisplayType.TABLE ||
                newValue.value === DisplayType.BIG_NUMBER) &&
              state.query?.length
            ) {
              dispatch({
                type: BuilderStateAction.SET_QUERY,
                payload: [state.query[0]!],
              });
            }
            trackAnalytics('dashboards_views.widget_builder.change', {
              from: source,
              widget_type: state.dataset ?? '',
              builder_version: WidgetBuilderVersion.SLIDEOUT,
              field: 'displayType',
              value: newValue?.value ?? '',
              new_widget: !isEditing,
              organization,
            });
          }}
          components={{
            SingleValue: (containerProps: any) => {
              return (
                <components.SingleValue {...containerProps}>
                  <SelectionWrapper>
                    {containerProps.data.leadingItems}
                    {containerProps.children}
                  </SelectionWrapper>
                </components.SingleValue>
              );
            },
          }}
        />
      </StyledFieldGroup>
    </Fragment>
  );
}

export default WidgetBuilderTypeSelector;

const SelectionWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const StyledFieldGroup = styled(FieldGroup)`
  width: 100%;
  padding: 0px;
`;
