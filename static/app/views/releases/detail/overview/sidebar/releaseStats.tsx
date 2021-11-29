import styled from '@emotion/styled';

import DeployBadge from 'sentry/components/deployBadge';
import NotAvailable from 'sentry/components/notAvailable';
import SidebarSection from 'sentry/components/sidebarSection';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Release, ReleaseProject} from 'sentry/types';

type Props = {
  organization: Organization;
  release: Release;
  project: Required<ReleaseProject>;
};

function ReleaseStats({organization, release, project}: Props) {
  const {lastDeploy, dateCreated, version} = release;

  return (
    <Container>
      <SidebarSection
        title={lastDeploy?.dateFinished ? t('Date Deployed') : t('Date Created')}
      >
        <TimeSince date={lastDeploy?.dateFinished ?? dateCreated} />
      </SidebarSection>

      <SidebarSection title={t('Last Deploy')}>
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
      </SidebarSection>
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: 50% 50%;
  grid-row-gap: ${space(2)};
`;

export default ReleaseStats;
