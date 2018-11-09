import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import CheckboxFancy from 'app/components/checkboxFancy';
import Highlight from 'app/components/highlight';
import IdBadge from 'app/components/idBadge';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

class ProjectSelectorItem extends React.PureComponent {
  static propTypes = {
    project: SentryTypes.Project,
    team: SentryTypes.Team,
    multi: PropTypes.bool,
    inputValue: PropTypes.string,
    isChecked: PropTypes.bool,
    onMultiSelect: PropTypes.func,
  };

  handleMultiSelect = e => {
    const {project, team, onMultiSelect} = this.props;
    onMultiSelect(project || team, e);
  };

  handleClick = e => {
    e.stopPropagation();
    this.handleMultiSelect(e);
  };

  render() {
    const {project, team, multi, inputValue, isChecked} = this.props;
    return (
      <ProjectRow>
        <BadgeAndBookmark>
          <BadgeWrapper multi={multi}>
            <IdBadgeMenuItem
              team={team}
              project={project}
              avatarSize={16}
              displayName={
                <Highlight text={inputValue}>
                  {(project && project.slug) || (team && `#${team.slug}`)}
                </Highlight>
              }
              avatarProps={{consistentWidth: true}}
            />
          </BadgeWrapper>
          {project && project.isBookmarked && <BookmarkIcon multi={multi} />}
        </BadgeAndBookmark>

        {multi && (
          <MultiSelectWrapper onClick={this.handleClick}>
            <MultiSelect checked={isChecked} />
          </MultiSelectWrapper>
        )}
      </ProjectRow>
    );
  }
}

const FlexY = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ProjectRow = styled(FlexY)`
  font-size: 14px;
  font-weight: 400;

  /* thanks bootstrap? */
  input[type='checkbox'] {
    margin: 0;
  }
`;

const BookmarkIcon = styled(({multi, ...props}) => (
  <div {...props}>
    <span className="icon-star-solid bookmark" />
  </div>
))`
  display: flex;
  font-size: 12px;
  ${p => p.multi && `margin-left: ${space(0.5)}`};
`;

const BadgeWrapper = styled('div')`
  display: flex;
  ${p => !p.multi && 'flex: 1'};
  white-space: nowrap;
  overflow: hidden;
`;
const BadgeAndBookmark = styled('div')`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const IdBadgeMenuItem = styled(IdBadge)`
  flex: 1;
  overflow: hidden;
`;

const MultiSelectWrapper = styled('div')`
  margin: -8px;
  padding: 8px;
`;

const MultiSelect = styled(CheckboxFancy)`
  flex-shrink: 0;
`;

export default ProjectSelectorItem;
