import styled from '@emotion/styled';

import {Group} from 'app/types';
import {tn} from 'app/locale';
import UserAvatar from 'app/components/avatar/userAvatar';
import space from 'app/styles/space';

type Props = {
  participants: Group['participants'];
};

const GroupParticipants = ({participants}: Props) => (
  <div>
    <h6>{tn('%s Participant', '%s Participants', participants.length)}</h6>
    <Faces>
      {participants.map(user => (
        <Face key={user.username}>
          <UserAvatar size={28} user={user} hasTooltip />
        </Face>
      ))}
    </Faces>
  </div>
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
