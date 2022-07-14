import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import {tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group} from 'sentry/types';

import SidebarSection from './sidebarSection';

type Props = {
  subscribed: Group['participants'];
};

const GroupSubscribed = ({subscribed}: Props) => (
  <SidebarSection title={tn('%s Subscribed', '%s Subscribed', subscribed.length)}>
    <Faces>
      {subscribed.map(user => (
        <Face key={user.username}>
          <UserAvatar size={28} user={user} hasTooltip />
        </Face>
      ))}
    </Faces>
  </SidebarSection>
);

export default GroupSubscribed;

const Faces = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const Face = styled('div')`
  margin-right: ${space(0.5)};
  margin-bottom: ${space(0.5)};
`;
