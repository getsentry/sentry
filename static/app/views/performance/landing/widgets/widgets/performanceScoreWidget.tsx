import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {getChartColorPalette} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import PerformanceScoreRingWithTooltips from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';
import {useProjectRawWebVitalsQuery} from 'sentry/views/insights/browser/webVitals/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {getWebVitalScoresFromTableDataRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {Subtitle, WidgetEmptyStateWarning} from '../components/selectableList';
import type {PerformanceWidgetProps} from '../types';

export function PerformanceScoreWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const {InteractiveTitle} = props;
  const {data: projectData, isPending} = useProjectRawWebVitalsQuery();
  const {data: projectScores, isPending: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery();

  const projectScore =
    isProjectScoresLoading || isPending
      ? undefined
      : getWebVitalScoresFromTableDataRow(projectScores?.data?.[0]);
  const ringSegmentColors = getChartColorPalette(3);
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  const moduleURL = useModuleURL('vital');

  return (
    <GenericPerformanceWidget
      {...props}
      location={location}
      Subtitle={() => <Subtitle>{props.subTitle}</Subtitle>}
      HeaderActions={() => (
        <div>
          <LinkButton to={`${moduleURL}/`} size="sm">
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
            const loading = isProjectScoresLoading;
            const data = projectScores;
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
              {projectScore ? (
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
                />
              ) : isPending ? (
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
