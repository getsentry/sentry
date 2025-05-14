import styled from '@emotion/styled';

import {DeployBadge} from 'sentry/components/core/badge/deployBadge';
import NotAvailable from 'sentry/components/notAvailable';
import * as SidebarSection from 'sentry/components/sidebarSection';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Release, ReleaseProject} from 'sentry/types/release';

type Props = {
  organization: Organization;
  project: Required<ReleaseProject>;
  release: Release;
};

function ReleaseStats({organization, release, project}: Props) {
  const {lastDeploy, dateCreated, version} = release;

  return (
    <Container>
      <SidebarSection.Wrap>
        <SidebarSection.Title>
          {lastDeploy?.dateFinished ? t('Date Deployed') : t('Date Created')}
        </SidebarSection.Title>
        <SidebarSection.Content>
          <TimeSince date={lastDeploy?.dateFinished ?? dateCreated} />
        </SidebarSection.Content>
      </SidebarSection.Wrap>

      <SidebarSection.Wrap>
        <SidebarSection.Title>{t('Last Deploy')}</SidebarSection.Title>
        <SidebarSection.Content>
          {lastDeploy?.dateFinished ? (
            <DeployBadge
              deploy={lastDeploy}
              orgSlug={organization.slug}
              version={version}
              projectId={project.id}
            />
          ) : (
            <NotAvailable />
          )}
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: 50% 50%;
  grid-row-gap: ${space(2)};
`;

export default ReleaseStats;
