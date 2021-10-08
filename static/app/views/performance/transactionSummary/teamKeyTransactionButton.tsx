import {Component} from 'react';

import Button from 'app/components/button';
import TeamKeyTransactionComponent, {
  TitleProps,
} from 'app/components/performance/teamKeyTransaction';
import * as TeamKeyTransactionManager from 'app/components/performance/teamKeyTransactionsManager';
import Tooltip from 'app/components/tooltip';
import {IconStar} from 'app/icons';
import {t, tn} from 'app/locale';
import {Organization, Project, Team} from 'app/types';
import {defined} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import Teams from 'app/utils/teams';
import withProjects from 'app/utils/withProjects';

/**
 * This can't be a function component because `TeamKeyTransaction` uses
 * `DropdownControl` which in turn uses passes a ref to this component.
 */
class TitleButton extends Component<TitleProps> {
  render() {
    const {isOpen, keyedTeams, ...props} = this.props;
    const keyedTeamsCount = keyedTeams?.length ?? 0;
    const button = (
      <Button
        {...props}
        icon={keyedTeamsCount ? <IconStar color="yellow300" isSolid /> : <IconStar />}
      >
        {keyedTeamsCount
          ? tn('Starred for Team', 'Starred for Teams', keyedTeamsCount)
          : t('Star for Team')}
      </Button>
    );

    if (!isOpen && keyedTeams?.length) {
      const teamSlugs = keyedTeams.map(({slug}) => slug).join(', ');
      return <Tooltip title={teamSlugs}>{button}</Tooltip>;
    } else {
      return button;
    }
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
  projects,
  ...props
}: WrapperProps) {
  if (eventView.project.length !== 1) {
    return <TitleButton isOpen={false} disabled keyedTeams={null} />;
  }

  const projectId = String(eventView.project[0]);
  const project = projects.find(proj => proj.id === projectId);
  if (!defined(project)) {
    return <TitleButton isOpen={false} disabled keyedTeams={null} />;
  }

  return (
    <Teams provideUserTeams>
      {({teams}) => (
        <TeamKeyTransactionManager.Provider
          organization={organization}
          teams={teams}
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
      )}
    </Teams>
  );
}

export default withProjects(TeamKeyTransactionButtonWrapper);
