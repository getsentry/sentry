import {Fragment, useState} from 'react';
import {IconClock} from '@sentry/icons/clock';
import {IconGraph} from '@sentry/icons/graph';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {getIntervalOptionsForPageFilter} from 'sentry/utils/useChartInterval';
import {useClassifiedCounts} from 'sentry/views/classifiers/hooks/useClassifiedCounts';
import {useClassifierOutput} from 'sentry/views/classifiers/hooks/useClassifierOutput';
import {useClassifierPageFilters} from 'sentry/views/classifiers/hooks/useClassifierPageFilters';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import {ChartType} from 'sentry/views/insights/common/components/chartTypes';

const TITLE = t('Instances');

function ClassifiedCounts({
  conversations,
  users,
}: {
  conversations: number;
  users: number;
}) {
  return (
    <Flex gap="lg">
      <Text size="sm" variant="muted">
        {conversations === 1
          ? t('1 conversation')
          : t('%s conversations', formatAbbreviatedNumber(conversations))}
      </Text>
      <Text size="sm" variant="muted">
        {users === 1 ? t('1 user') : t('%s users', formatAbbreviatedNumber(users))}
      </Text>
    </Flex>
  );
}

interface ClassifierInstancesChartProps {
  classifier: TelemetryClassifier;
}

export function ClassifierInstancesChart({classifier}: ClassifierInstancesChartProps) {
  const selection = useClassifierPageFilters(classifier);
  const {filter, output} = useClassifierOutput(classifier);
  const {data: classifiedCounts, isPending: isCountPending} =
    useClassifiedCounts(classifier);
  const [chartType, setChartType] = useState(ChartType.BAR);
  const [selectedInterval, setSelectedInterval] = useState<string | null>(null);

  const intervalOptions = getIntervalOptionsForPageFilter(selection.datetime);
  const chartInterval =
    intervalOptions.find(option => option.value === selectedInterval)?.value ??
    intervalOptions.at(-1)?.value;

  const pageFilters: PageFilters = {
    ...selection,
    projects: [Number(classifier.projectId)],
  };

  const chartIcon =
    chartType === ChartType.LINE ? 'line' : chartType === ChartType.AREA ? 'area' : 'bar';

  const actions = (
    <Fragment>
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              aria-label={t('Chart type')}
              icon={<IconGraph type={chartIcon} />}
              variant="transparent"
              showChevron={false}
              size="xs"
            />
          )}
          value={chartType}
          menuTitle={t('Type')}
          options={EXPLORE_CHART_TYPE_OPTIONS}
          onChange={option => setChartType(option.value)}
        />
      </Tooltip>
      <Tooltip title={t('Time interval displayed in this visualization (ex. 5m)')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              icon={<IconClock />}
              variant="transparent"
              showChevron={false}
              size="xs"
            />
          )}
          value={chartInterval}
          menuTitle={t('Interval')}
          options={intervalOptions}
          onChange={option => setSelectedInterval(option.value)}
        />
      </Tooltip>
    </Fragment>
  );

  let footer: React.ReactNode;
  if (isCountPending) {
    footer = <Placeholder width="160px" height="1lh" />;
  } else if (classifiedCounts !== undefined) {
    footer = <ClassifiedCounts {...classifiedCounts} />;
  }

  return (
    <Container height="280px">
      <Widget
        Title={<Widget.WidgetTitle title={TITLE} />}
        Actions={actions}
        revealActions="always"
        Visualization={
          <output.Visualization
            chartType={chartType}
            classifier={classifier}
            filter={filter}
            interval={chartInterval}
            pageFilters={pageFilters}
          />
        }
        Footer={footer}
      />
    </Container>
  );
}
