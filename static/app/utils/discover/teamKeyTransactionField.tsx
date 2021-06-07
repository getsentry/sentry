import {Component} from 'react';

import Button from 'app/components/button';
import TeamKeyTransaction, {
  TitleProps,
} from 'app/components/performance/teamKeyTransaction';
import * as TeamKeyTransactionManager from 'app/components/performance/teamKeyTransactionsManager';
import {IconStar} from 'app/icons';
import {Organization, Project, Team} from 'app/types';
import {defined} from 'app/utils';
import withProjects from 'app/utils/withProjects';
import withTeams from 'app/utils/withTeams';

class TitleStar extends Component<TitleProps> {
  render() {
    const {keyedTeamsCount, ...props} = this.props;
    const star = (
      <IconStar
        color={keyedTeamsCount ? 'yellow300' : 'gray200'}
        isSolid={keyedTeamsCount > 0}
        data-test-id="team-key-transaction-column"
      />
    );
    return <Button {...props} icon={star} borderless size="zero" />;
  }
}

type BaseProps = {
  teams: Team[];
  organization: Organization;
  isKeyTransaction: boolean;
};

type Props = BaseProps &
  TeamKeyTransactionManager.TeamKeyTransactionManagerChildrenProps & {
    project: number;
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
  const keyedTeams = getKeyedTeams(String(project), transactionName);

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
  projects: Project[];
  projectSlug: string | undefined;
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
  const projectId = project ? parseInt(project.id, 10) : null;

  // All these fields need to be defined in order to toggle a team key
  // transaction. Since they are not defined, just render a plain star
  // with no interactions.
  if (!defined(projectId) || !defined(transactionName)) {
    return <TitleStar keyedTeamsCount={Number(isKeyTransaction)} />;
  }

  return (
    <TeamKeyTransactionManager.Consumer>
      {results => (
        <TeamKeyTransactionField
          isKeyTransaction={isKeyTransaction}
          project={projectId}
          transactionName={transactionName}
          {...props}
          {...results}
        />
      )}
    </TeamKeyTransactionManager.Consumer>
  );
}

export default withTeams(withProjects(TeamKeyTransactionFieldWrapper));
