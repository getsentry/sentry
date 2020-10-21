import {Link} from 'react-router';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {
  ProjectTableLayout,
  ProjectTableDataElement,
} from 'app/views/organizationStats/projectTableLayout';
import Count from 'app/components/count';
import space from 'app/styles/space';

const ProjectTable = ({projectMap, projectTotals, orgTotal, organization}) => {
  const getPercent = (item, total) => {
    if (total === 0) {
      return '';
    }
    if (item === 0) {
      return '0%';
    }
    return parseInt((item / total) * 100, 10) + '%';
  };

  if (!projectTotals) {
    return <div />;
  }

  return projectTotals
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
};

ProjectTable.propTypes = {
  projectMap: PropTypes.object.isRequired,
  projectTotals: PropTypes.array.isRequired,
  orgTotal: PropTypes.object.isRequired,
  organization: PropTypes.object.isRequired,
};

const StyledProjectTitle = styled(ProjectTableDataElement)`
  display: flex;
  align-items: center;
  text-align: left;
`;

const StyledProjectTableLayout = styled(ProjectTableLayout)`
  padding: ${space(2)};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.borderLight};
  }
`;

const Percentage = styled(
  ({children, ...props}) => children !== '' && <div {...props}>{children}</div>
)`
  margin-top: ${space(0.25)};
  color: ${p => p.theme.gray500};
  font-size: 12px;
  line-height: 1.2;
`;

export default ProjectTable;
