import {Button} from 'sentry/components/button';
import TeamKeyTransaction from 'sentry/components/performance/teamKeyTransaction';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import {Tooltip} from 'sentry/components/tooltip';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import withProjects from 'sentry/utils/withProjects';

type BaseProps = {
  isKeyTransaction: boolean;
  organization: Organization;
};

type Props = BaseProps &
  TeamKeyTransactionManager.TeamKeyTransactionManagerChildrenProps & {
    project: Project;
    transactionName: string;
  };

function TeamKeyTransactionField({
  isKeyTransaction,
  counts,
  getKeyedTeams,
  project,
  transactionName,
  error,
  isLoading,
  ...props
}: Props) {
  const keyedTeams = getKeyedTeams(project.id, transactionName);
  const keyedTeamsCount = keyedTeams?.size ?? Number(isKeyTransaction);
  const disabled = isLoading || !!error;

  return (
    <TeamKeyTransaction
      size="sm"
      offset={[-12, 8]}
      counts={counts}
      keyedTeams={keyedTeams}
      project={project}
      transactionName={transactionName}
      trigger={(triggerProps, isOpen) => (
        <Tooltip
          disabled={disabled || isOpen}
          title={
            !isOpen && keyedTeams?.size
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
            borderless
            size="zero"
            icon={
              <IconStar
                color={keyedTeamsCount ? 'yellow400' : 'gray200'}
                isSolid={keyedTeamsCount > 0}
                data-test-id="team-key-transaction-column"
              />
            }
            aria-label={t('Toggle star for team')}
          />
        </Tooltip>
      )}
      {...props}
    />
  );
}

type WrapperProps = BaseProps & {
  projectSlug: string | undefined;
  projects: Project[];
  transactionName: string | undefined;
};

function TeamKeyTransactionFieldWrapper({
  isKeyTransaction,
  projects,
  projectSlug,
  transactionName,
  ...props
}: WrapperProps) {
  const project = projects.find(proj => proj.slug === projectSlug);

  // All these fields need to be defined in order to toggle a team key
  // transaction. Since they are not defined, just render a plain star
  // with no interactions.
  if (!defined(project) || !defined(transactionName)) {
    return (
      <Button
        disabled
        borderless
        size="zero"
        icon={<IconStar color="gray100" />}
        aria-label={t('Toggle star for team')}
      />
    );
  }

  return (
    <TeamKeyTransactionManager.Consumer>
      {results => (
        <TeamKeyTransactionField
          isKeyTransaction={isKeyTransaction}
          project={project}
          transactionName={transactionName}
          {...props}
          {...results}
        />
      )}
    </TeamKeyTransactionManager.Consumer>
  );
}

export default withProjects(TeamKeyTransactionFieldWrapper);
