import styled from '@emotion/styled';

import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import {PanelAlert} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import {Widget} from 'sentry/views/dashboardsV2/types';

import WidgetCard from '../../widgetCard';
import {DisplayType, displayTypes} from '../utils';

import {BuildStep} from './buildStep';

interface Props {
  displayType: DisplayType;
  onChange: (displayType: DisplayType) => void;
  organization: Organization;
  pageFilters: PageFilters;
  widget: Widget;
  widgetBuilderNewDesign: boolean;
  error?: string;
}

export function VisualizationStep({
  organization,
  pageFilters,
  displayType,
  error,
  onChange,
  widget,
  widgetBuilderNewDesign,
}: Props) {
  const options = widgetBuilderNewDesign
    ? Object.keys(displayTypes).filter(type => type !== DisplayType.TOP_N)
    : Object.keys(displayTypes);

  return (
    <BuildStep
      title={t('Choose your visualization')}
      description={t(
        'This is a preview of how your widget will appear in the dashboard.'
      )}
    >
      <Field error={error} inline={false} flexibleControlStateSize stacked>
        <SelectControl
          name="displayType"
          options={options.map(value => ({
            label: displayTypes[value],
            value,
          }))}
          value={displayType}
          onChange={(option: SelectValue<DisplayType>) => {
            onChange(option.value);
          }}
        />
      </Field>
      <VisualizationWrapper displayType={displayType}>
        <WidgetCard
          organization={organization}
          selection={pageFilters}
          widget={widget}
          isEditing={false}
          widgetLimitReached={false}
          renderErrorMessage={errorMessage =>
            typeof errorMessage === 'string' && (
              <PanelAlert type="error">{errorMessage}</PanelAlert>
            )
          }
          isSorting={false}
          currentWidgetDragging={false}
          noLazyLoad
        />
      </VisualizationWrapper>
    </BuildStep>
  );
}

const VisualizationWrapper = styled('div', {
  shouldForwardProp: prop => prop !== 'displayType',
})<{
  displayType: DisplayType;
}>`
  overflow: ${p => (p.displayType === DisplayType.TABLE ? 'hidden' : 'visible')};
  padding-right: ${space(2)};
`;
