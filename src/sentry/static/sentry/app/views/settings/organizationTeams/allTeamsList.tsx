import React from 'react';
import styled from '@emotion/styled';

import {openCreateTeamModal} from 'app/actionCreators/modal';
import {tct} from 'app/locale';
import TextBlock from 'app/views/settings/components/text/textBlock';
import Button from 'app/components/button';
import {Organization, Team} from 'app/types';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import AllTeamsRow from './allTeamsRow';

type Props = {
  urlPrefix: string;
  access: Record<string, any>;
  organization: Organization;
  teamList: Array<Team>;
  openMembership: boolean;
};

const AllTeamsList = ({
  organization,
  urlPrefix,
  openMembership,
  teamList,
  access,
}: Props) => {
  const teamNodes = teamList.map(team => (
    <AllTeamsRow
      urlPrefix={urlPrefix}
      access={access}
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
                  />
                ),
              })
            : null,
        })}
      </EmptyMessage>
    );
  }

  return teamNodes;
};

export default AllTeamsList;

const StyledButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeLarge};
`;
