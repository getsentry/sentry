import {useCallback, useEffect, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {TableCell} from 'sentry/components/charts/simpleTableChart';
import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import {PanelAlert} from 'sentry/components/panels';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import usePrevious from 'sentry/utils/usePrevious';
import {DisplayType, Widget} from 'sentry/views/dashboardsV2/types';

import WidgetCard from '../../widgetCard';
import {displayTypes} from '../utils';

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
  widgetBuilderNewDesign,
  widget,
}: Props) {
  const [debouncedWidget, setDebouncedWidget] = useState(widget);
  const previousWidget = usePrevious(widget);

  const debouceWidget = useCallback(
    debounce((value: Widget) => {
      setDebouncedWidget(value);
    }, DEFAULT_DEBOUNCE_DURATION),
    []
  );

  useEffect(() => {
    if (!isEqual(previousWidget, widget)) {
      debouceWidget(widget);
    }
  }, [widget, previousWidget]);

  const options = useMemo(
    () =>
      widgetBuilderNewDesign
        ? Object.keys(displayTypes).filter(key => key !== DisplayType.TOP_N)
        : Object.keys(displayTypes),
    []
  );

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
          widget={debouncedWidget}
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

const VisualizationWrapper = styled('div')<{displayType: DisplayType}>`
  padding-right: ${space(2)};
  ${p =>
    p.displayType === DisplayType.TABLE &&
    css`
      ${TableCell} {
        /* 24px ActorContainer height + 16px top and bottom padding + 1px border = 41px */
        height: 41px;
      }
      /* total size of a table, if it would display 5 rows of content */
      height: 300px;
      overflow: hidden;
    `};
`;
