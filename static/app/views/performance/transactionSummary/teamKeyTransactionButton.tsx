import {Component} from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import TeamKeyTransaction, {
  TitleProps,
} from 'app/components/performance/teamKeyTransaction';
import {IconStar} from 'app/icons';
import {t, tn} from 'app/locale';
import {Organization, Team} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import withTeams from 'app/utils/withTeams';

type Props = {
  eventView: EventView;
  organization: Organization;
  teams: Team[];
  transactionName: string;
};

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

function TeamKeyTransactionButton({eventView, teams, ...props}: Props) {
  if (eventView.project.length !== 1) {
    return <TitleButton disabled keyedTeamsCount={0} />;
  }

  const userTeams = teams.filter(({isMember}) => isMember);
  return (
    <TeamKeyTransaction
      teams={userTeams}
      project={eventView.project[0]}
      title={TitleButton}
      {...props}
    />
  );
}

const StyledButton = styled(Button)`
  width: 180px;
`;

export default withTeams(TeamKeyTransactionButton);
