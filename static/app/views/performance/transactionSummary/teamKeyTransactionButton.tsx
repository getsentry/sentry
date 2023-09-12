import {Button} from 'sentry/components/button';
import TeamKeyTransactionComponent from 'sentry/components/performance/teamKeyTransaction';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import {Tooltip} from 'sentry/components/tooltip';
import {IconStar} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {useTeams} from 'sentry/utils/useTeams';
import withProjects from 'sentry/utils/withProjects';

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
  isLoading,
  error,
  ...props
}: Props) {
  const keyedTeams = getKeyedTeams(project.id, transactionName);
  const keyedTeamsCount = keyedTeams?.size ?? 0;
  const disabled = isLoading || !!error;

  return (
    <TeamKeyTransactionComponent
      counts={counts}
      keyedTeams={keyedTeams}
      project={project}
      transactionName={transactionName}
      offset={8}
      size="md"
      trigger={(triggerProps, isOpen) => (
        <Tooltip
          disabled={disabled || isOpen}
          title={
            keyedTeams?.size
              ? project.teams
                  .filter(team => keyedTeams.has(team.id))
                  .map(({slug}) => slug)
                  .join(', ')
              : null
          }
        >
          <Button
            {...triggerProps}
            disabled={disabled}
            size="sm"
            icon={
              <IconStar
                isSolid={!!keyedTeamsCount}
                color={keyedTeamsCount ? 'yellow400' : 'subText'}
              />
            }
          >
            {keyedTeamsCount
              ? tn('Starred for Team', 'Starred for Teams', keyedTeamsCount)
              : t('Star for Team')}
          </Button>
        </Tooltip>
      )}
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
    return (
      <Button disabled size="sm" icon={<IconStar />}>
        {t('Star for Team')}
      </Button>
    );
  }

  const projectId = String(eventView.project[0]);
  const project = projects.find(proj => proj.id === projectId);
  if (!defined(project)) {
    return (
      <Button disabled size="sm" icon={<IconStar />}>
        {t('Star for Team')}
      </Button>
    );
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
