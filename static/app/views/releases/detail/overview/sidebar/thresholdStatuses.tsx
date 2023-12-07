import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconCheckmark, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Release, ReleaseProject} from 'sentry/types';
import {getExactDuration} from 'sentry/utils/formatters';
import useApi from 'sentry/utils/useApi';

import {
  ReleaseDetailsTable,
  ReleaseDetailsTableRow,
} from '../../../components/releaseDetailsSideTable';
import {fetchThresholdStatuses} from '../../../utils/fetchThresholdStatus';
import {ThresholdStatus, ThresholdStatusesQuery} from '../../../utils/types';

type Props = {
  organization: Organization;
  project: Required<ReleaseProject>;
  release: Release;
  selectedEnvs: string[];
};

function ThresholdStatuses({project, release, organization, selectedEnvs}: Props) {
  const api: Client = useApi();
  const [thresholdStatuses, setThresholdStatuses] = useState<ThresholdStatus[]>([]);
  const fetchThresholdStatusCallback = useCallback(async () => {
    const fuzzSec = 30;
    const start = new Date(new Date(release.dateCreated).getTime() - fuzzSec * 1000);
    const end = new Date(new Date(release.dateCreated).getTime() + fuzzSec * 1000);

    const releaseVersion: string = release.version;

    const query: ThresholdStatusesQuery = {
      start: start.toISOString(),
      end: end.toISOString(),
      release: [releaseVersion],
      project: [project.slug],
    };
    if (selectedEnvs.length) {
      query.environment = selectedEnvs;
    }
    return await fetchThresholdStatuses(organization, api, query);
  }, [release, project, selectedEnvs, organization, api]);

  useEffect(() => {
    fetchThresholdStatusCallback().then(thresholds => {
      const list = thresholds[`${project.slug}-${release.version}`];
      const sorted =
        list?.sort((a, b) => {
          const keyA: string = a.environment ? a.environment.name : '';
          const keyB: string = b.environment ? b.environment.name : '';

          return keyA.localeCompare(keyB);
        }) || [];

      setThresholdStatuses(sorted);
    });
  }, [fetchThresholdStatusCallback, project, release]);

  if (thresholdStatuses.length > 0) {
    return (
      <SidebarSection.Wrap>
        <SidebarSection.Title>{t('Threshold Statuses')}</SidebarSection.Title>
        <SidebarSection.Content>
          <ReleaseDetailsTable>
            {thresholdStatuses?.map(status => (
              <ReleaseDetailsTableRow
                key={status.id}
                type={status.is_healthy ? undefined : 'error'}
              >
                <RowGrid>
                  <div>{status.environment?.name}</div>
                  <div>{getExactDuration(status.window_in_seconds, true, 'seconds')}</div>
                  <div>
                    {status.threshold_type} {status.trigger_type === 'over' ? '>' : '<'}{' '}
                    {status.value}
                  </div>
                  <AlignRight>
                    {status.is_healthy ? (
                      <IconCheckmark color="successText" size="xs" />
                    ) : (
                      <IconWarning color="errorText" size="xs" />
                    )}
                  </AlignRight>
                </RowGrid>
              </ReleaseDetailsTableRow>
            ))}
          </ReleaseDetailsTable>
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }
  return null;
}

const AlignRight = styled('div')`
  text-align: right;
`;

const RowGrid = styled('div')`
  display: grid;
  grid-template-columns: 0.5fr 0.5fr max-content 0.1fr;
  gap: ${space(1)};
`;

export default ThresholdStatuses;
