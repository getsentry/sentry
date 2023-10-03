import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

import {HeaderCell, Table, TableData} from '../components/table';

import {ThresholdGroupRow} from './thresholdGroupRow';

type ThresholdQuery = {
  environments?: string[] | undefined;
  projects?: string[] | undefined;
};

type Props = {
  organization: Organization;
};

function ThresholdsList({organization}: Props) {
  // TODO: fetch threshold groupings
  const api = useApi();
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [selectedEnvs, setSelectedEnvs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchThresholds = useCallback(async () => {
    const path = `${organization.slug}/release-threshold-statuses/`;
    const query: ThresholdQuery = {};
    if (selectedProjects.length) {
      query.projects = selectedProjects;
    }
    if (selectedEnvs.length) {
      query.environments = selectedEnvs;
    }
    try {
      setIsLoading(true);
      const resp = await api.requestPromise(path, {
        method: 'GET',
        query,
      });
    } catch (err) {
      console.log();
    }
    setIsLoading(false);
  }, [api, organization, selectedEnvs, selectedProjects]);

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
        </tbody>
      </Table>
    </Wrapper>
  );
}

export default withOrganization(ThresholdsList);

const Wrapper = styled('div')`
  margin: ${space(2)} 0;
`;
