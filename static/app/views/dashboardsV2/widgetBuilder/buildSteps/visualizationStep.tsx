import {CSSProperties, useCallback, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {TableCell} from 'sentry/components/charts/simpleTableChart';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Field from 'sentry/components/forms/field';
import {PanelAlert} from 'sentry/components/panels';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import usePrevious from 'sentry/utils/usePrevious';
import {DashboardFilters, DisplayType, Widget} from 'sentry/views/dashboardsV2/types';

import {getDashboardFiltersFromURL} from '../../utils';
import WidgetCard, {WidgetCardPanel} from '../../widgetCard';
import {displayTypes} from '../utils';

import {BuildStep} from './buildStep';

interface Props {
  displayType: DisplayType;
  isWidgetInvalid: boolean;
  location: Location;
  onChange: (displayType: DisplayType) => void;
  organization: Organization;
  pageFilters: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  error?: string;
  noDashboardsMEPProvider?: boolean;
}

export function VisualizationStep({
  organization,
  pageFilters,
  displayType,
  error,
  onChange,
  widget,
  noDashboardsMEPProvider,
  dashboardFilters,
  location,
  isWidgetInvalid,
}: Props) {
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
    label: displayTypes[value],
    value,
  }));

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
      </Field>
      <VisualizationWrapper displayType={displayType}>
        <WidgetCard
          organization={organization}
          selection={pageFilters}
          widget={debouncedWidget}
          dashboardFilters={getDashboardFiltersFromURL(location) ?? dashboardFilters}
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
          showStoredAlert
          noDashboardsMEPProvider={noDashboardsMEPProvider}
          isWidgetInvalid={isWidgetInvalid}
        />
      </VisualizationWrapper>
    </BuildStep>
  );
}

const VisualizationWrapper = styled('div')<{displayType: DisplayType}>`
  padding-right: ${space(2)};
  ${WidgetCardPanel} {
    height: initial;
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
