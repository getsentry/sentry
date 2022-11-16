import {Component} from 'react';

import Button from 'sentry/components/button';
import TeamKeyTransactionComponent, {
  TitleProps,
} from 'sentry/components/performance/teamKeyTransaction';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import Tooltip from 'sentry/components/tooltip';
import {IconStar} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import useTeams from 'sentry/utils/useTeams';
import withProjects from 'sentry/utils/withProjects';

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
        size="sm"
        icon={keyedTeamsCount ? <IconStar color="yellow400" isSolid /> : <IconStar />}
      >
        {keyedTeamsCount
          ? tn('Starred for Team', 'Starred for Teams', keyedTeamsCount)
          : t('Star for Team')}
      </Button>
    );

    if (!isOpen && keyedTeams?.length) {
      const teamSlugs = keyedTeams.map(({slug}) => slug).join(', ');
      return <Tooltip title={teamSlugs}>{button}</Tooltip>;
    }
    return button;
  }
}

type BaseProps = {
  organization: Organization;
  transactionName: string;
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
  const {teams, initiallyLoaded} = useTeams({provideUserTeams: true});

  if (eventView.project.length !== 1) {
    return <TitleButton isOpen={false} disabled keyedTeams={null} />;
  }

  const projectId = String(eventView.project[0]);
  const project = projects.find(proj => proj.id === projectId);
  if (!defined(project)) {
    return <TitleButton isOpen={false} disabled keyedTeams={null} />;
  }

  return (
    <TeamKeyTransactionManager.Provider
      organization={organization}
      teams={teams}
      selectedTeams={['myteams']}
      selectedProjects={[String(projectId)]}
    >
      <TeamKeyTransactionManager.Consumer>
        {({isLoading, ...results}) => (
          <TeamKeyTransactionButton
            organization={organization}
            project={project}
            isLoading={isLoading || !initiallyLoaded}
            {...props}
            {...results}
          />
        )}
      </TeamKeyTransactionManager.Consumer>
    </TeamKeyTransactionManager.Provider>
  );
}

export default withProjects(TeamKeyTransactionButtonWrapper);
