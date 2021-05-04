import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'app/components/button';
import Collapsible from 'app/components/collapsible';
import IdBadge from 'app/components/idBadge';
import {tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization, ReleaseProject} from 'app/types';

import ProjectLink from '../../list/releaseHealth/projectLink';

import {SectionHeading, Wrapper} from './styles';

type Props = {
  projects: ReleaseProject[];
  location: Location;
  version: string;
  organization: Organization;
};

function OtherProjects({projects, location, version, organization}: Props) {
  return (
    <Wrapper>
      <SectionHeading>
        {tn(
          'Other Project for This Release',
          'Other Projects for This Release',
          projects.length
        )}
      </SectionHeading>

      <Collapsible
        expandButton={({onExpand, numberOfHiddenItems}) => (
          <Button priority="link" onClick={onExpand}>
            {tn(
              'Show %s collapsed project',
              'Show %s collapsed projects',
              numberOfHiddenItems
            )}
          </Button>
        )}
      >
        {projects.map(project => (
          <Row key={project.id}>
            <IdBadge project={project} avatarSize={16} />
            <ProjectLink
              location={location}
              orgSlug={organization.slug}
              releaseVersion={version}
              project={project}
            />
          </Row>
        ))}
      </Collapsible>
    </Wrapper>
  );
}

const Row = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(0.75)};
  font-size: ${p => p.theme.fontSizeMedium};

  @media (min-width: ${p => p.theme.breakpoints[1]}) and (max-width: ${p =>
      p.theme.breakpoints[2]}) {
    grid-template-columns: 200px max-content;
  }
`;

export default OtherProjects;
