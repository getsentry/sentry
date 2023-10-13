import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelTable from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

import {Threshold, ThresholdQuery} from '../utils/types';

import {ThresholdGroupRow} from './thresholdGroupRow';

type Props = {
  organization: Organization;
  selectedEnvs: string[];
  selectedProjects: number[];
};

function ThresholdsList({organization, selectedEnvs, selectedProjects}: Props) {
  const api = useApi();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [_featureEnabledFlag, setFeatureEnabledFlag] = useState<boolean>(true);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [errors, setErrors] = useState<string | null>();

  const thresholdGroups: {[key: string]: {[key: string]: Threshold[]}} = useMemo(() => {
    const byProj = {};
    thresholds.forEach(threshold => {
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
  }, [thresholds]);

  const fetchThresholds = useCallback(async () => {
    //   re_path(
    //     r"^(?P<organization_slug>[^\/]+)/releases/thresholds/$",
    //     ReleaseThresholdIndexEndpoint.as_view(),
    //     name="sentry-api-0-organization-release-thresholds",
    // ),
    const path = `/organizations/${organization.id}/releases/thresholds/`;
    const query: ThresholdQuery = {};
    if (selectedProjects.length) {
      query.project = selectedProjects;
    } else {
      query.project = [-1];
    }
    if (selectedEnvs.length) {
      query.environment = selectedEnvs;
    }
    try {
      setIsLoading(true);
      const resp = await api.requestPromise(path, {
        method: 'GET',
        query,
      });
      setThresholds(resp);
    } catch (err) {
      if (err.status === 404) {
        setErrors('Error fetching release thresholds');
      } else if (err.status === 403) {
        // NOTE: If release thresholds are not enabled, API will return a 403 not found
        // So capture this case and set enabled to false
        setFeatureEnabledFlag(false);
      } else {
        setErrors(err.statusText);
      }
    }
    setIsLoading(false);
  }, [api, organization, selectedEnvs, selectedProjects]);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds, selectedEnvs, selectedProjects]);

  if (errors) {
    return <LoadingError onRetry={fetchThresholds} message={errors} />;
  }
  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <Wrapper>
      <StyledPanelTable
        isLoading={isLoading}
        isEmpty={thresholds.length === 0 && !errors}
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
