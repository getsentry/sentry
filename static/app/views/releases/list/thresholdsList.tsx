import {useMemo} from 'react';
import styled from '@emotion/styled';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelTable from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {Threshold} from '../utils/types';
import useFetchThresholdsListData from '../utils/useFetchThresholdsListData';

import {ThresholdGroupRow} from './thresholdGroupRow';

type Props = {
  selectedEnvs: string[];
  selectedProjectIds: number[];
};

function ThresholdsList({selectedEnvs, selectedProjectIds}: Props) {
  const {
    data: thresholds = [],
    error,
    isLoading,
    isError,
    refetch,
  } = useFetchThresholdsListData({
    selectedProjectIds,
  });

  // NOTE: currently no way to filter for 'None' environments
  const filteredThresholds = selectedEnvs.length
    ? thresholds.filter(
        threshold => selectedEnvs.indexOf(threshold.environment.name) > -1
      )
    : thresholds;

  const thresholdGroups: {[key: string]: {[key: string]: Threshold[]}} = useMemo(() => {
    const byProj = {};
    filteredThresholds.forEach(threshold => {
      const projId = threshold.project.id;
      if (!byProj[projId]) {
        byProj[projId] = {};
      }
      const env = threshold.environment.name;
      if (!byProj[projId][env]) {
        byProj[projId][env] = [];
      }
      byProj[projId][env].push(threshold);
    });
    return byProj;
  }, [filteredThresholds]);

  if (isError) {
    return <LoadingError onRetry={refetch} message={error.message} />;
  }
  if (isLoading) {
    return <LoadingIndicator />;
  }

  // TODO: make each proj/env their own grouping
  // introduce + row btn
  // figure out form logic....
  return (
    <Wrapper>
      <StyledPanelTable
        isLoading={isLoading}
        isEmpty={filteredThresholds.length === 0 && !isError}
        emptyMessage={t('No thresholds found.')}
        headers={[
          t('Project Name'),
          t('Environment'),
          t('Window'),
          t('Conditions'),
          t('Actions'),
        ]}
      >
        {thresholdGroups &&
          Object.entries(thresholdGroups).map(([projId, byEnv]) => {
            return Object.entries(byEnv).map(([envName, thresholdGroup]) => (
              <ThresholdGroupRow
                key={`${projId}-${envName}`}
                thresholds={thresholdGroup}
              />
            ));
          })}
      </StyledPanelTable>
    </Wrapper>
  );
}

export default ThresholdsList;

const Wrapper = styled('div')`
  margin: ${space(2)} 0;
`;

const StyledPanelTable = styled(PanelTable)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    overflow: initial;
  }

  grid-template-columns:
    minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(250px, 4fr)
    auto;
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
`;
