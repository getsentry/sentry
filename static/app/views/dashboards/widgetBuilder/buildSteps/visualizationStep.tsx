import type {CSSProperties} from 'react';
import {useCallback, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {TableCell} from 'sentry/components/charts/simpleTableChart';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import PanelAlert from 'sentry/components/panels/panelAlert';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters, SelectValue} from 'sentry/types/core';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import type {DashboardFilters, Widget, WidgetType} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {WidgetCardPanel} from 'sentry/views/dashboards/widgetCard/widgetCardPanel';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';

import {IndexedEventsSelectionAlert} from '../../indexedEventsSelectionAlert';
import {getDashboardFiltersFromURL} from '../../utils';
import WidgetCard from '../../widgetCard';
import type WidgetLegendSelectionState from '../../widgetLegendSelectionState';
import {displayTypes} from '../utils';

import {BuildStep} from './buildStep';

interface Props {
  displayType: DisplayType;
  isWidgetInvalid: boolean;
  location: Location;
  onChange: (displayType: DisplayType) => void;
  pageFilters: PageFilters;
  widget: Widget;
  widgetLegendState: WidgetLegendSelectionState;
  dashboardFilters?: DashboardFilters;
  error?: string;
  onDataFetched?: (results: TableDataWithTitle[]) => void;
  onWidgetSplitDecision?: (splitDecision: WidgetType) => void;
}

export function VisualizationStep({
  pageFilters,
  displayType,
  error,
  onChange,
  widget,
  onDataFetched,
  dashboardFilters,
  location,
  isWidgetInvalid,
  onWidgetSplitDecision,
  widgetLegendState,
}: Props) {
  const organization = useOrganization();
  const [debouncedWidget, setDebouncedWidget] = useState(widget);

  const previousWidget = usePrevious(widget);

  // Disabling for now because we use debounce to avoid excessively hitting
  // our endpoints, but useCallback wants an inline function and not one
  // returned from debounce
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceWidget = useCallback(
    debounce((value: Widget, shouldCancelUpdates: boolean) => {
      if (shouldCancelUpdates) {
        return;
      }
      setDebouncedWidget(value);
    }, DEFAULT_DEBOUNCE_DURATION),
    []
  );

  useEffect(() => {
    let shouldCancelUpdates = false;

    if (!isEqual(previousWidget, widget)) {
      debounceWidget(widget, shouldCancelUpdates);
    }

    return () => {
      shouldCancelUpdates = true;
    };
  }, [widget, previousWidget, debounceWidget]);

  const displayOptions = Object.keys(displayTypes).map(value => ({
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    label: displayTypes[value],
    value,
  }));

  const unselectedReleasesForCharts = {
    [WidgetLegendNameEncoderDecoder.encodeSeriesNameForLegend(
      'Releases',
      debouncedWidget.id
    )]: false,
  };

  return (
    <StyledBuildStep
      title={t('Choose your visualization')}
      description={t(
        'This is a preview of how your widget will appear in the dashboard.'
      )}
    >
      <FieldGroup error={error} inline={false} flexibleControlStateSize stacked>
        <SelectControl
          name="displayType"
          options={displayOptions}
          value={displayType}
          onChange={(option: SelectValue<DisplayType>) => {
            onChange(option.value);
          }}
          styles={{
            singleValue: (provided: CSSProperties) => ({
              ...provided,
              width: `calc(100% - ${space(1)})`,
            }),
          }}
        />
      </FieldGroup>
      <VisualizationWrapper displayType={displayType}>
        <WidgetCard
          organization={organization}
          selection={pageFilters}
          widget={debouncedWidget}
          dashboardFilters={getDashboardFiltersFromURL(location) ?? dashboardFilters}
          isEditingDashboard={false}
          widgetLimitReached={false}
          renderErrorMessage={errorMessage =>
            typeof errorMessage === 'string' && (
              <PanelAlert margin={false} type="error">
                {errorMessage}
              </PanelAlert>
            )
          }
          isWidgetInvalid={isWidgetInvalid}
          onDataFetched={onDataFetched}
          onWidgetSplitDecision={onWidgetSplitDecision}
          shouldResize={false}
          onLegendSelectChanged={() => {}}
          legendOptions={
            widgetLegendState.widgetRequiresLegendUnselection(widget)
              ? {selected: unselectedReleasesForCharts}
              : undefined
          }
          widgetLegendState={widgetLegendState}
          disableFullscreen
        />

        <IndexedEventsSelectionAlert widget={widget} />
      </VisualizationWrapper>
    </StyledBuildStep>
  );
}

const StyledBuildStep = styled(BuildStep)`
  position: sticky;
  top: 0;
  z-index: 100;
  background: ${p => p.theme.background};

  &::before {
    margin-top: 1px;
  }
`;

const VisualizationWrapper = styled('div')<{displayType: DisplayType}>`
  padding-right: ${space(2)};
  ${WidgetCardPanel} {
    height: initial;
    min-height: 120px;
  }
  ${p =>
    p.displayType === DisplayType.TABLE &&
    css`
      overflow: hidden;
      ${TableCell} {
        /* 24px ActorContainer height + 16px top and bottom padding + 1px border = 41px */
        height: 41px;
      }
      ${WidgetCardPanel} {
        /* total size of a table, if it would display 5 rows of content */
        height: 301px;
      }
    `};
`;
