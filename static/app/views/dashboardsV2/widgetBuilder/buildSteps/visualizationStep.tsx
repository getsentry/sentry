import {CSSProperties, useCallback, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {TableCell} from 'sentry/components/charts/simpleTableChart';
import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import {PanelAlert} from 'sentry/components/panels';
import Tag from 'sentry/components/tag';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import usePrevious from 'sentry/utils/usePrevious';
import {DisplayType, Widget} from 'sentry/views/dashboardsV2/types';

import WidgetCard, {WidgetCardPanel} from '../../widgetCard';
import {displayTypes} from '../utils';

import {BuildStep} from './buildStep';

interface Props {
  displayType: DisplayType;
  onChange: (displayType: DisplayType) => void;
  organization: Organization;
  pageFilters: PageFilters;
  widget: Widget;
  error?: string;
}

export function VisualizationStep({
  organization,
  pageFilters,
  displayType,
  error,
  onChange,
  widget,
}: Props) {
  const [debouncedWidget, setDebouncedWidget] = useState(widget);

  const previousWidget = usePrevious(widget);

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
  }, [widget, previousWidget]);

  const displayOptions = Object.keys(displayTypes).map(value => ({
    label:
      organization.features.includes('new-widget-builder-experience-design') &&
      value === DisplayType.TOP_N ? (
        <DisplayOptionLabel>
          {displayTypes[value]}
          <Tag type="info">{t('deprecated')}</Tag>
        </DisplayOptionLabel>
      ) : (
        displayTypes[value]
      ),
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

const DisplayOptionLabel = styled('span')`
  display: flex;
  justify-content: space-between;
  width: calc(100% - ${space(1)});
`;
