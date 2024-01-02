import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import PerformanceScoreRingWithTooltips from 'sentry/views/performance/browser/webVitals/components/performanceScoreRingWithTooltips';
import {calculatePerformanceScoreFromTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {useProjectRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {Subtitle, WidgetEmptyStateWarning} from '../components/selectableList';
import {PerformanceWidgetProps} from '../types';

export function PerformanceScoreWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const {InteractiveTitle, organization} = props;
  const theme = useTheme();
  const shouldUseStoredScores = useStoredScoresSetting();
  const {data: projectData, isLoading} = useProjectRawWebVitalsQuery();
  const {data: projectScores, isLoading: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery({enabled: shouldUseStoredScores});

  const noTransactions = !isLoading && !projectData?.data?.[0]?.['count()'];

  const projectScore =
    (shouldUseStoredScores && isProjectScoresLoading) || isLoading || noTransactions
      ? undefined
      : shouldUseStoredScores
      ? calculatePerformanceScoreFromStoredTableDataRow(projectScores?.data?.[0])
      : calculatePerformanceScoreFromTableDataRow(projectData?.data?.[0]);
  const ringSegmentColors = theme.charts.getColorPalette(3);
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  const weights = projectScore
    ? {
        cls: projectScore.clsWeight,
        fid: projectScore.fidWeight,
        fcp: projectScore.fcpWeight,
        lcp: projectScore.lcpWeight,
        ttfb: projectScore.ttfbWeight,
      }
    : undefined;

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
      Queries={{
        project: {
          component: provided => {
            const loading = shouldUseStoredScores ? isProjectScoresLoading : isLoading;
            const data = shouldUseStoredScores ? projectScores : projectData;
            return (
              <Fragment>
                {provided.children({
                  data,
                  isLoading: loading,
                  hasData: !loading && (data?.data?.[0]?.['count()'] as number) > 0,
                })}
              </Fragment>
            );
          },
          fields: [],
          transform: function (_: any, results: any) {
            return results;
          },
        },
      }}
      Visualizations={[
        {
          component: () => (
            <Wrapper>
              {projectScore && !noTransactions ? (
                <PerformanceScoreRingWithTooltips
                  inPerformanceWidget
                  projectScore={projectScore}
                  projectData={projectData}
                  y={40}
                  text={
                    <span style={{fontSize: 'xxx-large'}}>{projectScore.totalScore}</span>
                  }
                  width={280}
                  height={240}
                  size={160}
                  barWidth={16}
                  ringBackgroundColors={ringBackgroundColors}
                  ringSegmentColors={ringSegmentColors}
                  radiusPadding={10}
                  labelHeightPadding={0}
                  weights={weights}
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
