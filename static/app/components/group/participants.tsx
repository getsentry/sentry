import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group} from 'sentry/types';

type Props = {
  participants: Group['participants'];
};

const GroupParticipants = ({participants}: Props) => (
  <SidebarSection.Wrap>
    <SidebarSection.Title>
      {tn('%s Participant', '%s Participants', participants.length)}
    </SidebarSection.Title>
    <SidebarSection.Content>
      <Faces>
        {participants.map(user => (
          <Face key={user.username}>
            <UserAvatar size={28} user={user} hasTooltip />
          </Face>
        ))}
      </Faces>
    </SidebarSection.Content>
  </SidebarSection.Wrap>
);

export default GroupParticipants;

const Faces = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const Face = styled('div')`
  margin-right: ${space(0.5)};
  margin-bottom: ${space(0.5)};
`;
