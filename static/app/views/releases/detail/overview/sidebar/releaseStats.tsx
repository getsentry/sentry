import styled from '@emotion/styled';

import DeployBadge from 'app/components/deployBadge';
import NotAvailable from 'app/components/notAvailable';
import ReleaseSidebarSection from 'app/components/releaseSidebarSection';
import TimeSince from 'app/components/timeSince';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Release, ReleaseProject} from 'app/types';

type Props = {
  organization: Organization;
  release: Release;
  project: Required<ReleaseProject>;
};

function ReleaseStats({organization, release, project}: Props) {
  const {lastDeploy, dateCreated, version} = release;

  return (
    <Container>
      <div>
        <ReleaseSidebarSection
          title={lastDeploy?.dateFinished ? t('Date Deployed') : t('Date Created')}
        >
          <TimeSince date={lastDeploy?.dateFinished ?? dateCreated} />
        </ReleaseSidebarSection>
      </div>

      <div>
        <ReleaseSidebarSection title={t('Last Deploy')}>
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
        </ReleaseSidebarSection>
      </div>
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: 50% 50%;
  grid-row-gap: ${space(2)};
  margin-bottom: ${space(3)};
`;

export default ReleaseStats;
