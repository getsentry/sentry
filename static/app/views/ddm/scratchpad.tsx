import {useCallback, useLayoutEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import * as echarts from 'echarts/core';

import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MetricWidgetQueryParams} from 'sentry/utils/metrics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DDM_CHART_GROUP, MIN_WIDGET_WIDTH} from 'sentry/views/ddm/constants';
import {useDDMContext} from 'sentry/views/ddm/context';

import {MetricWidget} from './widget';

export function MetricScratchpad() {
  const {
    setSelectedWidgetIndex,
    selectedWidgetIndex,
    widgets,
    updateWidget,
    addWidget,
    focusArea,
    addFocusArea,
    removeFocusArea,
  } = useDDMContext();
  const {selection} = usePageFilters();
  const organization = useOrganization();

  // Make sure all charts are connected to the same group whenever the widgets definition changes
  useLayoutEffect(() => {
    echarts.connect(DDM_CHART_GROUP);
  }, [widgets]);

  const handleChange = useCallback(
    (index: number, widget: Partial<MetricWidgetQueryParams>) => {
      updateWidget(index, widget);
    },
    [updateWidget]
  );

  const hasEmptyWidget = widgets.length === 0 || widgets.some(widget => !widget.mri);
  const Wrapper =
    widgets.length === 1 ? StyledSingleWidgetWrapper : StyledMetricDashboard;

  return (
    <Wrapper>
      {widgets.map((widget, index) => (
        <MetricWidget
          key={index}
          index={index}
          onSelect={setSelectedWidgetIndex}
          isSelected={selectedWidgetIndex === index}
          hasSiblings={widgets.length > 1}
          onChange={handleChange}
          widget={widget}
          datetime={selection.datetime}
          projects={selection.projects}
          environments={selection.environments}
          addFocusArea={addFocusArea}
          removeFocusArea={removeFocusArea}
          focusArea={focusArea}
        />
      ))}
      <AddWidgetPanel
        disabled={hasEmptyWidget}
        onClick={
          !hasEmptyWidget
            ? () => {
                trackAnalytics('ddm.widget.add', {
                  organization,
                });
                Sentry.metrics.increment('ddm.widget.add');

                addWidget();
              }
            : undefined
        }
      >
        <Button disabled={hasEmptyWidget} icon={<IconAdd isCircled />}>
          {t('Add widget')}
        </Button>
      </AddWidgetPanel>
    </Wrapper>
  );
}

const StyledMetricDashboard = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(${MIN_WIDGET_WIDTH}px, 1fr));
  gap: ${space(2)};

  @media (max-width: ${props => props.theme.breakpoints.xxlarge}) {
    grid-template-columns: repeat(2, minmax(${MIN_WIDGET_WIDTH}px, 1fr));
  }
  @media (max-width: ${props => props.theme.breakpoints.xlarge}) {
    grid-template-columns: repeat(1, minmax(${MIN_WIDGET_WIDTH}px, 1fr));
  }
  grid-auto-rows: auto;
`;

const StyledSingleWidgetWrapper = styled('div')`
  display: grid;
  grid-template-columns: minmax(${MIN_WIDGET_WIDTH}px, 90%) minmax(180px, 10%);

  @media (max-width: ${props => props.theme.breakpoints.xlarge}) {
    grid-template-columns: repeat(1, minmax(${MIN_WIDGET_WIDTH}px, 1fr));
  }

  gap: ${space(2)};

  grid-auto-rows: auto;
`;

const AddWidgetPanel = styled(Panel)<{disabled: boolean}>`
  height: 100%;
  margin-bottom: 0;
  padding: ${space(4)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px dashed ${p => (p.disabled ? p.theme.disabledBorder : p.theme.border)};

  ${p =>
    !p.disabled &&
    `
    &:hover {
      background-color: ${p.theme.backgroundSecondary};
      cursor: pointer;
    }
  `}
`;
