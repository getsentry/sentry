import styled from '@emotion/styled';
import {Location} from 'history';

import {Button} from 'sentry/components/button';
import Collapsible from 'sentry/components/collapsible';
import IdBadge from 'sentry/components/idBadge';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, ReleaseProject} from 'sentry/types';

type Props = {
  location: Location;
  organization: Organization;
  projects: ReleaseProject[];
  version: string;
};

function OtherProjects({projects, location, version, organization}: Props) {
  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>
        {tn(
          'Other Project for This Release',
          'Other Projects for This Release',
          projects.length
        )}
      </SidebarSection.Title>
      <SidebarSection.Content>
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
              <Button
                size="xs"
                to={{
                  pathname: `/organizations/${
                    organization.slug
                  }/releases/${encodeURIComponent(version)}/`,
                  query: {
                    ...extractSelectionParameters(location.query),
                    project: project.id,
                    yAxis: undefined,
                  },
                }}
              >
                {t('View')}
              </Button>
            </Row>
          ))}
        </Collapsible>
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

const Row = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(0.75)};
  font-size: ${p => p.theme.fontSizeMedium};

  @media (min-width: ${p => p.theme.breakpoints.medium}) and (max-width: ${p =>
      p.theme.breakpoints.large}) {
    grid-template-columns: 200px max-content;
  }
`;

export default OtherProjects;
