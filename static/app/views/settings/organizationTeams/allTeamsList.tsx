import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import {t, tct} from 'sentry/locale';
import type {Organization, Team} from 'sentry/types/organization';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import AllTeamsRow from './allTeamsRow';

type Props = {
  access: Record<string, any>;
  openMembership: boolean;
  organization: Organization;
  teamList: Team[];
};

function AllTeamsList({organization, openMembership, teamList, access}: Props) {
  const teamNodes = teamList.map(team => (
    <AllTeamsRow
      team={team}
      organization={organization}
      openMembership={openMembership}
      key={team.slug}
    />
  ));

  if (!teamNodes.length) {
    const canCreateTeam = access.has('project:admin');

    return (
      <EmptyMessage>
        {tct('No teams here. [teamCreate]', {
          root: <TextBlock noMargin />,
          teamCreate: canCreateTeam
            ? tct('You can always [link:create one].', {
                link: (
                  <StyledButton
                    priority="link"
                    onClick={() =>
                      openCreateTeamModal({
                        organization,
                      })
                    }
                    aria-label={t('Create team')}
                  />
                ),
              })
            : null,
        })}
      </EmptyMessage>
    );
  }

  return <Fragment>{teamNodes}</Fragment>;
}

export default AllTeamsList;

const StyledButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeMedium};
`;
