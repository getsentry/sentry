import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {BarSeriesOption} from 'echarts';

import {Button} from '@sentry/scraps/button/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {Grid} from '@sentry/scraps/layout';
import {Flex} from '@sentry/scraps/layout/flex';

import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {Text} from 'sentry/components/core/text';
import BaseSearchBar from 'sentry/components/searchBar';
import {IconSearch, IconTimer, IconWarning} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

import {CHART_AXIS_LABEL_FONT_SIZE, CHARTS_COLUMN_COUNT} from './constants';
import {formatChartXAxisLabel, percentageFormatter} from './utils';

function FeedbackButton() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <StyledFeedbackButton
      size="xs"
      aria-label="attribute-breakdowns-feedback"
      icon={<IconMegaphone size="xs" />}
      onClick={() =>
        openForm?.({
          messagePlaceholder: t(
            'How can we make attribute breakdowns work better for you?'
          ),
          tags: {
            ['feedback.source']: 'attribute-breakdowns',
            ['feedback.owner']: 'ml-ai',
          },
        })
      }
    >
      {t('Feedback')}
    </StyledFeedbackButton>
  );
}

function FeedbackLink() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return (
      <a href="mailto:support@sentry.io?subject=Attribute%20breakdowns%20failed%20to%20load">
        {t('Send us feedback')}
      </a>
    );
  }

  return (
    <a href="#" onClick={() => openForm?.()}>
      {t('Send us feedback')}
    </a>
  );
}

const StyledIconSearch = styled(IconSearch)`
  color: ${p => p.theme.subText};
`;

const StyledIconWarning = styled(IconWarning)`
  color: ${p => p.theme.subText};
`;

const StyledIconTimer = styled(IconTimer)`
  color: ${p => p.theme.subText};
`;

const ERROR_STATE_CONFIG: Record<
  number | 'default',
  {
    icon: React.ReactNode;
    subtitle: React.ReactNode;
    title: string;
  }
> = {
  504: {
    title: t('Query timed out'),
    icon: <StyledIconTimer size="xl" />,
    subtitle: tct(
      'You can try narrowing the time range. Seeing this often? [feedbackLink]',
      {
        feedbackLink: <FeedbackLink />,
      }
    ),
  },
  default: {
    title: t('Failed to load attribute breakdowns'),
    icon: <StyledIconWarning size="xl" />,
    subtitle: tct('Seeing this often? [feedbackLink]', {
      feedbackLink: <FeedbackLink />,
    }),
  },
};

function ErrorState({error}: {error: RequestError}) {
  const config =
    ERROR_STATE_CONFIG[error?.status ?? 'default'] ?? ERROR_STATE_CONFIG.default;

  return (
    <Flex direction="column" gap="2xl" padding="3xl" align="center" justify="center">
      {config.icon}
      <Text size="xl" variant="muted">
        {config.title}
      </Text>
      <Text size="md" variant="muted">
        {config.subtitle}
      </Text>
    </Flex>
  );
}

function EmptySearchState() {
  return (
    <Flex direction="column" gap="2xl" padding="3xl" align="center" justify="center">
      <StyledIconSearch size="xl" />
      <Text size="xl" variant="muted">
        {t('No matching attributes found')}
      </Text>
      <Text size="md" variant="muted">
        {tct('Expecting results? [feedbackLink]', {
          feedbackLink: <FeedbackLink />,
        })}
      </Text>
    </Flex>
  );
}

const ChartWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 200px;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.lg} 0 ${p => p.theme.space.lg};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  overflow: hidden;
  min-width: 0;
`;

const ChartsGrid = styled(Grid)`
  grid-template-columns: repeat(${CHARTS_COLUMN_COUNT}, 1fr);
  gap: ${p => p.theme.space.md};
`;

const ChartHeaderWrapper = styled(Flex)`
  margin-bottom: ${p => p.theme.space.md};
  max-width: 100%;
`;

const ChartTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.colors.gray800};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PopulationIndicator = styled(Flex)<{color?: string}>`
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 500;
  color: ${p => p.color || p.theme.colors.gray500};

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${p => p.color || p.theme.colors.gray500};
    margin-right: ${space(0.5)};
  }
`;

const ControlsContainer = styled(Flex)`
  gap: ${space(0.5)};
  align-items: center;
`;

const StyledBaseSearchBar = styled(BaseSearchBar)`
  flex: 1;
`;

const StyledFeedbackButton = styled(Button)`
  height: 31px !important;
`;

const PaginationContainer = styled(Flex)`
  justify-content: end;
`;

type PaginationProps = {
  isNextDisabled: boolean;
  isPrevDisabled: boolean;
  onNextClick: () => void;
  onPrevClick: () => void;
};

function Pagination({
  isPrevDisabled,
  isNextDisabled,
  onPrevClick,
  onNextClick,
}: PaginationProps) {
  return (
    <PaginationContainer>
      <ButtonBar merged gap="0">
        <Button
          icon={<IconChevron direction="left" />}
          aria-label={t('Previous')}
          size="sm"
          disabled={isPrevDisabled}
          onClick={onPrevClick}
        />
        <Button
          icon={<IconChevron direction="right" />}
          aria-label={t('Next')}
          size="sm"
          disabled={isNextDisabled}
          onClick={onNextClick}
        />
      </ButtonBar>
    </PaginationContainer>
  );
}

type ChartProps = {
  chartRef: React.RefObject<ReactEchartsRef | null>;
  chartWidth: number;
  maxSeriesValue: number;
  series: BarSeriesOption[];
  tooltip: TooltipOption;
  xAxisData: string[];
};

function Chart({
  xAxisData,
  maxSeriesValue,
  series,
  tooltip,
  chartWidth,
  chartRef,
}: ChartProps) {
  const theme = useTheme();

  return (
    <BaseChart
      ref={chartRef}
      autoHeightResize
      isGroupedByDate={false}
      tooltip={tooltip}
      grid={{
        left: 2,
        right: 8,
        bottom: 40,
        containLabel: false,
      }}
      xAxis={{
        show: true,
        type: 'category',
        data: xAxisData,
        truncate: 14,
        axisLabel:
          xAxisData.length > 20
            ? {
                show: false,
              }
            : {
                hideOverlap: false,
                showMaxLabel: false,
                showMinLabel: false,
                color: theme.tokens.content.muted,
                interval: 0,
                fontSize: CHART_AXIS_LABEL_FONT_SIZE,
                formatter: (value: string) =>
                  formatChartXAxisLabel(value, xAxisData.length, chartWidth),
              },
      }}
      yAxis={{
        type: 'value',
        interval: maxSeriesValue < 1 ? 1 : undefined,
        axisLabel: {
          fontSize: 12,
          formatter: (value: number) => {
            return percentageFormatter(value);
          },
        },
      }}
      series={series}
    />
  );
}

export const AttributeBreakdownsComponent = {
  FeedbackButton,
  ErrorState,
  EmptySearchState,
  ChartsGrid,
  ChartWrapper,
  Chart,
  ChartHeaderWrapper,
  ChartTitle,
  PopulationIndicator,
  ControlsContainer,
  StyledBaseSearchBar,
  Pagination,
};
