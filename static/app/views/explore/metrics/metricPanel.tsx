import {useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import SplitPanel from 'sentry/components/splitPanel';
import {IconHide, IconShow} from 'sentry/icons';
import {IconPanel} from 'sentry/icons/iconPanel';
import {t} from 'sentry/locale';
import {useBreakpoints} from 'sentry/utils/useBreakpoints';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useMetricTimeseries} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';
import {MetricsGraph} from 'sentry/views/explore/metrics/metricGraph';
import MetricInfoTabs from 'sentry/views/explore/metrics/metricInfoTabs';
import {SAMPLES_PANEL_MIN_WIDTH} from 'sentry/views/explore/metrics/metricInfoTabs/samplesTab';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

interface MetricPanelProps {
  queryIndex: number;
  traceMetric: TraceMetric;
}

type Orientation = 'side-by-side' | 'stacked';

const MIN_LEFT_WIDTH = 400;

// Defined by the size of the expected samples tab component
const PADDING_SIZE = 16;
const MIN_RIGHT_WIDTH = SAMPLES_PANEL_MIN_WIDTH + PADDING_SIZE;

export function MetricPanel({traceMetric, queryIndex}: MetricPanelProps) {
  const breakpoints = useBreakpoints();
  const [orientation, setOrientation] = useState<Orientation>(
    breakpoints.sm ? 'side-by-side' : 'stacked'
  );
  const {result: timeseriesResult} = useMetricTimeseries({
    traceMetric,
    enabled: Boolean(traceMetric.name),
  });

  const currentOrientation = breakpoints.md ? orientation : 'stacked';

  return (
    <Panel>
      <PanelBody>
        {currentOrientation === 'side-by-side' ? (
          <SideBySideOrientation
            timeseriesResult={timeseriesResult}
            queryIndex={queryIndex}
            traceMetric={traceMetric}
            setOrientation={setOrientation}
            orientation={currentOrientation}
          />
        ) : (
          <StackedOrientation
            timeseriesResult={timeseriesResult}
            queryIndex={queryIndex}
            traceMetric={traceMetric}
            setOrientation={setOrientation}
            orientation={currentOrientation}
          />
        )}
      </PanelBody>
    </Panel>
  );
}

function StackedOrientation({
  timeseriesResult,
  queryIndex,
  traceMetric,
  orientation,
  setOrientation,
}: {
  orientation: Orientation;
  queryIndex: number;
  setOrientation: (orientation: Orientation) => void;
  timeseriesResult: ReturnType<typeof useMetricTimeseries>['result'];
  traceMetric: TraceMetric;
}) {
  const breakpoints = useBreakpoints();
  const [infoContentHidden, setInfoContentHidden] = useState(false);
  const additionaGraphActions = (
    <PanelPositionDropdown
      orientation={orientation}
      setOrientation={setOrientation}
      disabled={!breakpoints.md}
    />
  );
  const Icon = infoContentHidden ? IconHide : IconShow;
  const additionalInfoTabActions = (
    <Button
      size="zero"
      borderless
      aria-label={infoContentHidden ? t('Show Info Tab') : t('Hide Info Tab')}
      icon={<Icon size="sm" />}
      onClick={() => setInfoContentHidden(!infoContentHidden)}
    />
  );
  return (
    <Stack>
      <MetricsGraph
        timeseriesResult={timeseriesResult}
        queryIndex={queryIndex}
        additionalActions={additionaGraphActions}
        orientation={orientation}
      />
      <MetricInfoTabs
        traceMetric={traceMetric}
        additionalActions={additionalInfoTabActions}
        contentsHidden={infoContentHidden}
        orientation={orientation}
      />
    </Stack>
  );
}

function SideBySideOrientation({
  timeseriesResult,
  queryIndex,
  traceMetric,
  orientation,
  setOrientation,
}: {
  orientation: Orientation;
  queryIndex: number;
  setOrientation: (orientation: Orientation) => void;
  timeseriesResult: ReturnType<typeof useMetricTimeseries>['result'];
  traceMetric: TraceMetric;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: measureRef});

  const hasSize = width > 0;
  // Default split is 65% of the available width, but not less than MIN_LEFT_WIDTH
  // and at most the maximum size allowed for the left panel (i.e. width - MIN_RIGHT_WIDTH)
  const defaultSplit = Math.min(
    Math.max(width * 0.65, MIN_LEFT_WIDTH),
    width - MIN_RIGHT_WIDTH
  );

  const additionalActions = (
    <SideBySidePositionSelectorWrapper>
      <PanelPositionDropdown orientation={orientation} setOrientation={setOrientation} />
    </SideBySidePositionSelectorWrapper>
  );

  return (
    <div ref={measureRef}>
      {hasSize ? (
        <SplitPanel
          availableSize={width}
          left={{
            content: (
              <MetricsGraph
                timeseriesResult={timeseriesResult}
                queryIndex={queryIndex}
                orientation={orientation}
              />
            ),
            default: defaultSplit,
            min: MIN_LEFT_WIDTH,
            max: width - MIN_RIGHT_WIDTH,
          }}
          right={
            <MetricInfoTabs
              traceMetric={traceMetric}
              additionalActions={additionalActions}
              orientation={orientation}
            />
          }
        />
      ) : null}
    </div>
  );
}

function PanelPositionDropdown({
  orientation,
  setOrientation,
  disabled,
}: {
  orientation: Orientation;
  setOrientation: (orientation: Orientation) => void;
  disabled?: boolean;
}) {
  const options = [
    {
      key: 'side-by-side',
      label: t('Side by Side'),
      disabled: orientation === 'side-by-side',
      onAction: () => setOrientation('side-by-side'),
      leadingItems: <IconPanel direction="right" size="md" />,
    },
    {
      key: 'stacked',
      label: t('Stacked'),
      disabled: orientation === 'stacked',
      onAction: () => setOrientation('stacked'),
      leadingItems: <IconPanel direction="down" size="md" />,
    },
  ];

  return (
    <DropdownMenu
      size="sm"
      isDisabled={disabled}
      items={options}
      menuTitle={<div>{t('Panel Position')}</div>}
      trigger={triggerProps => (
        <Tooltip title={t('Panel Position')}>
          <Button
            {...triggerProps}
            size="zero"
            aria-label={t('Panel position')}
            icon={<IconPanel direction="right" />}
            borderless
          />
        </Tooltip>
      )}
    />
  );
}

const SideBySidePositionSelectorWrapper = styled('div')`
  margin-top: ${p => p.theme.space.md};
`;
