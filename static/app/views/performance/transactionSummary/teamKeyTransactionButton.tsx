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

function TitleButton({disabled, keyedTeamsCount}: TitleProps) {
  return (
    <StyledButton
      disabled={disabled}
      icon={keyedTeamsCount ? <IconStar color="yellow300" isSolid /> : <IconStar />}
    >
      {keyedTeamsCount
        ? tn('Starred for Team', 'Starred for Teams', keyedTeamsCount)
        : t('Star for Team')}
    </StyledButton>
  );
}

const StyledButton = styled(Button)`
  width: 180px;
`;

export default withTeams(TeamKeyTransactionButton);
