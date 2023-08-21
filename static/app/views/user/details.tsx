import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import UserBadge from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
// import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
// import ConfigStore from 'sentry/stores/configStore';
// import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
// import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
// import useOrganization from 'sentry/utils/useOrganization';

type Props = RouteComponentProps<{userId: string}, {}, any, {name: string}>;

// /api/0/organizations/sentry-emerging-tech/members/11040776/
//
function UserDetails({params: {userId}}: Props) {
  // const config = useLegacyStore(ConfigStore);
  const location = useLocation();
  const name = location.query.name;
  // const organization = useOrganization();
  // const {slug: orgSlug} = organization;
  const title = 'User Profile';

  const header = (
    <Header>
      <UserBadge
        avatarSize={32}
        displayName={<Layout.Title>{name || t('Unknown User')}</Layout.Title>}
        user={{
          name: name || '',
          // email: user.email || '',
          // username: user.username || '',
          // ip_address: user.ip || '',
          id: userId || '',
        }}
        displayEmail=""
      />

      <ButtonActionsWrapper>
        <div>:fire: 1</div>
        <div>:fire: 1</div>
        <div>:fire: 1</div>
      </ButtonActionsWrapper>
    </Header>
  );

  return (
    <SentryDocumentTitle title={title}>
      <FullViewport>{header}</FullViewport>
    </SentryDocumentTitle>
  );
}

// {isError ? <DetailedError
//   hideSupportLinks
//   heading={t('Error loading user')}
//   message={
//       <p>
//       User not found
//       </p>
//   }
// /> :
// <>
// </>}

const Header = styled(Layout.Header)`
  gap: ${space(1)};
  padding-bottom: ${space(1.5)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    gap: ${space(1)} ${space(3)};
    padding: ${space(2)} ${space(2)} ${space(1.5)} ${space(2)};
  }
`;

// TODO(replay); This could make a lot of sense to put inside HeaderActions by default
const ButtonActionsWrapper = styled(Layout.HeaderActions)`
  flex-direction: row;
  justify-content: flex-end;
  gap: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    margin-bottom: 0;
  }
`;

const FullViewport = styled('div')`
  height: 100vh;
  width: 100%;

  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;

  /*
   * The footer component is a sibling of this div.
   * Remove it so the replay can take up the
   * entire screen.
   */
  ~ footer {
    display: none;
  }

  /*
  TODO: Set \`body { overflow: hidden; }\` so that the body doesn't wiggle
  when you try to scroll something that is non-scrollable.
  */
`;

export default UserDetails;
