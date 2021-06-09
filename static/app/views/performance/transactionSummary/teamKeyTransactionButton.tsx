import {Component} from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import TeamKeyTransactionComponent, {
  TitleProps,
} from 'app/components/performance/teamKeyTransaction';
import * as TeamKeyTransactionManager from 'app/components/performance/teamKeyTransactionsManager';
import {IconStar} from 'app/icons';
import {t, tn} from 'app/locale';
import {Organization, Project, Team} from 'app/types';
import {defined} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import withProjects from 'app/utils/withProjects';
import withTeams from 'app/utils/withTeams';

/**
 * This can't be a function component because `TeamKeyTransaction` uses
 * `DropdownControl` which in turn uses passes a ref to this component.
 */
class TitleButton extends Component<TitleProps> {
  render() {
    const {keyedTeamsCount, ...props} = this.props;
    return (
      <StyledButton
        {...props}
        icon={keyedTeamsCount ? <IconStar color="yellow300" isSolid /> : <IconStar />}
      >
        {keyedTeamsCount
          ? tn('Starred for Team', 'Starred for Teams', keyedTeamsCount)
          : t('Star for Team')}
      </StyledButton>
    );
  }
}

type BaseProps = {
  organization: Organization;
  transactionName: string;
  teams: Team[];
};

type Props = BaseProps &
  TeamKeyTransactionManager.TeamKeyTransactionManagerChildrenProps & {
    project: Project;
  };

function TeamKeyTransactionButton({
  counts,
  getKeyedTeams,
  project,
  transactionName,
  ...props
}: Props) {
  const keyedTeams = getKeyedTeams(project.id, transactionName);
  return (
    <TeamKeyTransactionComponent
      counts={counts}
      keyedTeams={keyedTeams}
      title={TitleButton}
      project={project}
      transactionName={transactionName}
      {...props}
    />
  );
}

type WrapperProps = BaseProps & {
  eventView: EventView;
  projects: Project[];
};

function TeamKeyTransactionButtonWrapper({
  eventView,
  organization,
  teams,
  projects,
  ...props
}: WrapperProps) {
  if (eventView.project.length !== 1) {
    return <TitleButton disabled keyedTeamsCount={0} />;
  }

  const projectId = String(eventView.project[0]);
  const project = projects.find(proj => proj.id === projectId);
  if (!defined(project)) {
    return <TitleButton disabled keyedTeamsCount={0} />;
  }

  const userTeams = teams.filter(({isMember}) => isMember);

  return (
    <TeamKeyTransactionManager.Provider
      organization={organization}
      teams={userTeams}
      selectedTeams={['myteams']}
      selectedProjects={[String(projectId)]}
    >
      <TeamKeyTransactionManager.Consumer>
        {results => (
          <TeamKeyTransactionButton
            organization={organization}
            project={project}
            {...props}
            {...results}
          />
        )}
      </TeamKeyTransactionManager.Consumer>
    </TeamKeyTransactionManager.Provider>
  );
}

const StyledButton = styled(Button)`
  width: 180px;
`;

export default withTeams(withProjects(TeamKeyTransactionButtonWrapper));
