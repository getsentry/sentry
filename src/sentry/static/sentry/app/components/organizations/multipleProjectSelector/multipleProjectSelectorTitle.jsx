import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import IdBadge from 'app/components/idBadge';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes from 'app/sentryTypes';

class MultipleProjectSelectorTitle extends React.PureComponent {
  static propTypes = {
    projects: PropTypes.arrayOf(SentryTypes.Project),
    teams: PropTypes.arrayOf(SentryTypes.Team),
    loading: PropTypes.bool,
    showTeams: PropTypes.bool,
  };

  render() {
    const {className, loading, projects, teams, showTeams} = this.props;
    const hasSelected = !!projects.length || !!teams.length;
    const items = !loading &&
      hasSelected && [
        ...teams.map(team => ({team})),
        ...projects.map(project => ({project})),
      ];

    return (
      <div className={className}>
        {showTeams && loading && <LoadingIndicator mini />}
        {!loading && !hasSelected && t('All Projects')}
        {items &&
          items.map(({project, team}) => (
            <IdBadge
              hideAvatar={true}
              avatarSize={20}
              key={(project || team).slug}
              project={project}
              team={team}
            />
          ))}
      </div>
    );
  }
}

const StyledMultipleProjectSelectorTitle = styled(MultipleProjectSelectorTitle)`
  display: flex;
  justify-content: space-between;
`;
export default StyledMultipleProjectSelectorTitle;
