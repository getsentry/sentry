import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import PerformanceScoreRingWithTooltips from 'sentry/views/performance/browser/webVitals/components/performanceScoreRingWithTooltips';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {Subtitle, WidgetEmptyStateWarning} from '../components/selectableList';
import {PerformanceWidgetProps} from '../types';

export function PerformanceScoreWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const {InteractiveTitle, organization} = props;
  const theme = useTheme();
  const {data: projectData, isLoading} = useProjectWebVitalsQuery();

  const noTransactions = !isLoading && projectData?.data[0]['count()'] === 0;

  const projectScore =
    isLoading || noTransactions
      ? undefined
      : calculatePerformanceScore({
          lcp: projectData?.data[0]['p75(measurements.lcp)'] as number,
          fcp: projectData?.data[0]['p75(measurements.fcp)'] as number,
          cls: projectData?.data[0]['p75(measurements.cls)'] as number,
          ttfb: projectData?.data[0]['p75(measurements.ttfb)'] as number,
          fid: projectData?.data[0]['p75(measurements.fid)'] as number,
        });

  const ringSegmentColors = theme.charts.getColorPalette(3);
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  return (
    <GenericPerformanceWidget
      {...props}
      location={location}
      Subtitle={() => <Subtitle>{props.subTitle}</Subtitle>}
      HeaderActions={() => (
        <div>
          <LinkButton
            to={`/organizations/${organization.slug}/performance/browser/pageloads/`}
            size="sm"
          >
            {t('View All')}
          </LinkButton>
        </div>
      )}
      InteractiveTitle={
        InteractiveTitle ? () => <InteractiveTitle isLoading={false} /> : null
      }
      EmptyComponent={WidgetEmptyStateWarning}
      Queries={{}}
      Visualizations={[
        {
          component: () => (
            <Wrapper>
              {projectScore && !noTransactions ? (
                <PerformanceScoreRingWithTooltips
                  inPerformanceWidget
                  projectScore={projectScore}
                  projectData={projectData}
                  y={25}
                  text={
                    <span style={{fontSize: 'xxx-large'}}>{projectScore.totalScore}</span>
                  }
                  width={280}
                  height={240}
                  size={200}
                  barWidth={20}
                  webVitalLabelCoordinates={{
                    lcp: {x: 80, y: 25},
                    fcp: {x: 60, y: 55},
                    fid: {x: 10, y: 65},
                    cls: {x: -5, y: 15},
                    ttfb: {x: 10, y: -10},
                  }}
                  ringBackgroundColors={ringBackgroundColors}
                  ringSegmentColors={ringSegmentColors}
                />
              ) : isLoading ? (
                <StyledLoadingIndicator size={40} />
              ) : (
                <WidgetEmptyStateWarning />
              )}
            </Wrapper>
          ),
          height: 124 + props.chartHeight,
          noPadding: true,
        },
      ]}
    />
  );
}

const Wrapper = styled('div')`
  padding-top: 10px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid ${p => p.theme.gray200};
  margin-top: ${space(1)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
