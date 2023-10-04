import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Environment, Organization, Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

import {HeaderCell, Table, TableData} from '../components/table';

// import {ThresholdGroupRow} from './thresholdGroupRow';

type ThresholdQuery = {
  environment?: string[] | undefined;
  project?: number[] | undefined;
};

type Threshold = {
  date_added: string;
  environment: Environment;
  id: string;
  project: Project;
  threshold_type: string;
  trigger_type: string;
  value: number;
  window_in_seconds: number;
};

type Props = {
  organization: Organization;
  selectedEnvs: string[];
  selectedProjects: number[];
};

function ThresholdsList({organization, selectedEnvs, selectedProjects}: Props) {
  // TODO: fetch threshold groupings
  const api = useApi();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [_featureEnabledFlag, setFeatureEnabledFlag] = useState<boolean>(true);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [errors, setErrors] = useState<string | null>();

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
      <Table data-test-id="allocations-table">
        <colgroup>
          <col id="projNameCol" style={{width: '25%'}} />
          <col id="envCol" style={{width: '15%'}} />
          <col id="windowCol" style={{width: '15%'}} />
          <col id="conditionsCol" style={{width: '25%'}} />
          {/* <col id="alertsCol" style={{width: '15%'}} /> */}
          <col id="actionsCol" style={{width: '5%'}} />
        </colgroup>
        <tbody>
          <tr>
            <HeaderCell>{t('Project Name')}</HeaderCell>
            <HeaderCell>{t('Environment')}</HeaderCell>
            <HeaderCell>{t('Window')}</HeaderCell>
            <HeaderCell>{t('Conditions')}</HeaderCell>
            {/* TODO: <HeaderCell>{t('Alerts')}</HeaderCell> */}
            <HeaderCell style={{textAlign: 'right'}}>{t('Actions')}</HeaderCell>
          </tr>
          <tr>
            <TableData>project name</TableData>
            <TableData>environment</TableData>
            <TableData>window</TableData>
            <TableData>conditions</TableData>
            <TableData>actions</TableData>
          </tr>
          {thresholds &&
            thresholds.map((threshold: Threshold) => {
              return (
                <tr key={threshold.id}>
                  <TableData>{threshold.project.name}</TableData>
                </tr>
              );
            })}
        </tbody>
      </Table>
    </Wrapper>
  );
}

export default ThresholdsList;

const Wrapper = styled('div')`
  margin: ${space(2)} 0;
`;
