import {Fragment} from 'react';
import styled from '@emotion/styled';

import {DateTimeObject} from 'app/components/charts/utils';
import IdBadge from 'app/components/idBadge';
import {PanelTable} from 'app/components/panels';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';

import ProjectStabilityColumn from './projectStabilityColumn';

type Props = {
  organization: Organization;
  projects: Project[];
} & DateTimeObject;

function TeamStability({projects, organization, period, start, end, utc}: Props) {
  return (
    <PanelTable headers={[t('Project'), t('Crash Free Rate'), t('New Issues')]}>
      {projects.map(project => (
        <Fragment key={project.id}>
          <ProjectBadgeContainer>
            <ProjectBadge avatarSize={18} project={project} />
          </ProjectBadgeContainer>

          <ProjectStabilityColumn
            organization={organization}
            project={project}
            hasSessions={project.hasSessions}
            period={period}
            start={start}
            end={end}
            utc={utc}
          />
          <div>5</div>
        </Fragment>
      ))}
    </PanelTable>
  );
}

export default TeamStability;

const ProjectBadgeContainer = styled('div')`
  width: 100%;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;
