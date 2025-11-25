import {useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button/button';
import {Flex} from '@sentry/scraps/layout/flex';

import BaseChart from 'sentry/components/charts/baseChart';
import {Text} from 'sentry/components/core/text';
import Placeholder from 'sentry/components/placeholder';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

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

function LoadingChart() {
  const theme = useTheme();
  const seriesData = useMemo(() => {
    // Generate a random length between 10 and 40
    const length = Math.floor(Math.random() * 31) + 10;

    // Generate random values between 10 and 100
    return Array.from({length}, () => Math.floor(Math.random() * 91) + 10);
  }, []);

  return (
    <LoadingChartWrapper>
      <ChartHeaderWrapper justify="between" align="center" gap="lg">
        <ChartTitle>
          <StyledPlaceholder _height={20} _width={80} />
        </ChartTitle>
        <Flex gap="sm">
          <StyledPlaceholder _height={20} _width={40} />
        </Flex>
      </ChartHeaderWrapper>
      <BaseChart
        autoHeightResize
        isGroupedByDate={false}
        tooltip={{
          show: false,
        }}
        grid={{
          left: 2,
          right: 8,
          bottom: 30,
          containLabel: false,
        }}
        xAxis={{
          show: false,
        }}
        yAxis={{
          show: false,
        }}
        series={[
          {
            type: 'bar',
            data: seriesData,
            itemStyle: {
              color: theme.backgroundTertiary,
            },
            barMaxWidth: 20,
            animation: false,
          },
        ]}
      />
    </LoadingChartWrapper>
  );
}

function LoadingCharts() {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowMessage(true);
    }, 10 * 1000); // 10 seconds
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Flex direction="column" gap="xl">
      {showMessage && (
        <Text size="md" variant="muted">
          {t(
            'This is taking a bit longer. You can try narrowing the time range to get results faster.'
          )}
        </Text>
      )}
      <ChartsGrid>
        {Array.from({length: 9}).map((_, index) => (
          <LoadingChart key={index} />
        ))}
      </ChartsGrid>
    </Flex>
  );
}

const StyledPlaceholder = styled(Placeholder)<{_height: number; _width: number}>`
  border-radius: ${p => p.theme.borderRadius};
  height: ${p => p._height}px;
  width: ${p => p._width}px;
  background-color: ${p => p.theme.backgroundTertiary};
`;

const ChartWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 200px;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.lg} 0 ${p => p.theme.space.lg};
  border: 1px solid ${p => p.theme.border};
  overflow: hidden;
  min-width: 0;
`;

const LoadingChartWrapper = styled(ChartWrapper)`
  animation: blink-opacity 4s linear infinite;

  @keyframes blink-opacity {
    0% {
      opacity: 1;
    }
    25% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
    75% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
`;

const ChartsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${p => p.theme.space.md};
`;

const ChartHeaderWrapper = styled(Flex)`
  margin-bottom: ${p => p.theme.space.md};
  max-width: 100%;
`;

const ChartTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.gray500};
  ${p => p.theme.overflowEllipsis};
`;

const StyledFeedbackButton = styled(Button)`
  height: 31px !important;
`;

export const AttributeBreakdownsComponent = {
  FeedbackButton,
  LoadingCharts,
};
