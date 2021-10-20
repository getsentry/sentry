import styled from '@emotion/styled';

import {SectionHeading} from 'app/components/charts/styles';
import DeployBadge from 'app/components/deployBadge';
import NotAvailable from 'app/components/notAvailable';
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
        <SectionHeading>
          {lastDeploy?.dateFinished ? t('Date Deployed') : t('Date Created')}
        </SectionHeading>
        <div>
          <TimeSince date={lastDeploy?.dateFinished ?? dateCreated} />
        </div>
      </div>

      <div>
        <SectionHeading>{t('Last Deploy')}</SectionHeading>
        <div>
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
        </div>
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
