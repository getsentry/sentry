import {Component} from 'react';

import Button from 'sentry/components/button';
import TeamKeyTransaction, {
  TitleProps,
} from 'sentry/components/performance/teamKeyTransaction';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import Tooltip from 'sentry/components/tooltip';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import withProjects from 'sentry/utils/withProjects';

class TitleStar extends Component<TitleProps> {
  render() {
    const {isOpen, keyedTeams, initialValue, ...props} = this.props;
    const keyedTeamsCount = keyedTeams?.length ?? initialValue ?? 0;
    const star = (
      <IconStar
        color={keyedTeamsCount ? 'yellow300' : 'gray200'}
        isSolid={keyedTeamsCount > 0}
        data-test-id="team-key-transaction-column"
      />
    );
    const button = (
      <Button
        {...props}
        icon={star}
        borderless
        size="zero"
        aria-label={t('Toggle star for team')}
      />
    );

    if (!isOpen && keyedTeams?.length) {
      const teamSlugs = keyedTeams.map(({slug}) => slug).join(', ');
      return <Tooltip title={teamSlugs}>{button}</Tooltip>;
    }
    return button;
  }
}

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
  ...props
}: Props) {
  const keyedTeams = getKeyedTeams(project.id, transactionName);

  return (
    <TeamKeyTransaction
      counts={counts}
      keyedTeams={keyedTeams}
      title={TitleStar}
      project={project}
      transactionName={transactionName}
      initialValue={Number(isKeyTransaction)}
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
      <TitleStar
        isOpen={false}
        disabled
        keyedTeams={null}
        initialValue={Number(isKeyTransaction)}
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
