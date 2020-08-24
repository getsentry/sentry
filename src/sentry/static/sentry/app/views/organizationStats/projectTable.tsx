import React from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import {
  ProjectTableLayout,
  ProjectTableDataElement,
} from 'app/views/organizationStats/projectTableLayout';
import Count from 'app/components/count';
import {formatPercentage} from 'app/utils/formatters';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';

import {ProjectTotal} from './types';

type Props = {
  organization: Organization;
  projectMap: Record<string, Project>;
  projectTotals: ProjectTotal[];
  orgTotal: ProjectTotal & {avgRate: number};
};

const ProjectTable = ({projectMap, projectTotals, orgTotal, organization}: Props) => {
  const getPercent = (item: number, total: number): string => {
    if (total === 0) {
      return '';
    }
    return formatPercentage(item / total, 0);
  };

  if (!projectTotals) {
    return null;
  }

  const elements = projectTotals
    .sort((a, b) => b.received - a.received)
    .map((item, index) => {
      const project = projectMap[item.id];

      if (!project) {
        return null;
      }

      const projectLink = `/settings/${organization.slug}/projects/${project.slug}/`;

      return (
        <StyledProjectTableLayout key={index}>
          <StyledProjectTitle>
            <Link to={projectLink}>{project.slug}</Link>
          </StyledProjectTitle>
          <ProjectTableDataElement>
            <Count value={item.accepted} />
            <Percentage>{getPercent(item.accepted, orgTotal.accepted)}</Percentage>
          </ProjectTableDataElement>
          <ProjectTableDataElement>
            <Count value={item.rejected} />
            <Percentage>{getPercent(item.rejected, orgTotal.rejected)}</Percentage>
          </ProjectTableDataElement>
          <ProjectTableDataElement>
            <Count value={item.blacklisted} />
            <Percentage>{getPercent(item.blacklisted, orgTotal.blacklisted)}</Percentage>
          </ProjectTableDataElement>
          <ProjectTableDataElement>
            <Count value={item.received} />
            <Percentage>{getPercent(item.received, orgTotal.received)}</Percentage>
          </ProjectTableDataElement>
        </StyledProjectTableLayout>
      );
    });
  return <React.Fragment>{elements}</React.Fragment>;
};

const StyledProjectTitle = styled(ProjectTableDataElement)`
  display: flex;
  align-items: center;
  text-align: left;
`;

const StyledProjectTableLayout = styled(ProjectTableLayout)`
  padding: ${space(2)};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

type PercentageProps = React.HTMLProps<HTMLDivElement>;

const Percentage = styled(({children, ...props}: PercentageProps) => {
  if (children === '') {
    return null;
  }
  return <div {...props}>{children}</div>;
})`
  margin-top: ${space(0.25)};
  color: ${p => p.theme.gray500};
  font-size: 12px;
  line-height: 1.2;
`;

export default ProjectTable;
