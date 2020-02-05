import React from 'react';
import styled from '@emotion/styled';

import {tct} from 'app/locale';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {Project} from 'app/types';
import space from 'app/styles/space';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import {AutoCompleteItem} from 'app/components/dropdownAutoCompleteMenu';

type Props = {
  projects: Project[];
  maxLines?: number;
};

const ProjectList = ({projects, maxLines = 2}: Props) => {
  let visibleProjects: Project[], hiddenProjects: Project[];

  if (projects.length <= maxLines) {
    visibleProjects = projects;
    hiddenProjects = [];
  } else {
    // because we need one line for `and X more`
    visibleProjects = projects.slice(0, maxLines - 1);
    hiddenProjects = projects.slice(maxLines - 1, projects.length);
  }

  return (
    <React.Fragment>
      {visibleProjects.map(project => (
        <StyledProjectBadge project={project} avatarSize={14} key={project.slug} />
      ))}
      {hiddenProjects.length > 0 && (
        <StyledDropdownAutoComplete
          maxHeight={400}
          items={hiddenProjects.map(p => ({
            searchKey: p.slug,
            label: <StyledProjectBadge project={p} avatarSize={14} />,
          }))}
          alignMenu="left"
          searchPlaceholder="Filter projects"
        >
          {() =>
            tct('and [count] more', {
              count: hiddenProjects.length,
            })
          }
        </StyledDropdownAutoComplete>
      )}
    </React.Fragment>
  );
};

const StyledProjectBadge = styled(ProjectBadge)`
  &:not(:last-child) {
    margin-bottom: ${space(0.5)};
  }
`;

const StyledDropdownAutoComplete = styled(DropdownAutoComplete)`
  ${AutoCompleteItem} {
    &,
    &:hover {
      background: transparent;
      cursor: default;
    }
  }
`;

export default ProjectList;
