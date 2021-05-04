import styled from '@emotion/styled';

import UserAvatar from 'app/components/avatar/userAvatar';
import {tn} from 'app/locale';
import space from 'app/styles/space';
import {Group} from 'app/types';

import SidebarSection from './sidebarSection';

type Props = {
  participants: Group['participants'];
};

const GroupParticipants = ({participants}: Props) => (
  <SidebarSection title={tn('%s Participant', '%s Participants', participants.length)}>
    <Faces>
      {participants.map(user => (
        <Face key={user.username}>
          <UserAvatar size={28} user={user} hasTooltip />
        </Face>
      ))}
    </Faces>
  </SidebarSection>
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
