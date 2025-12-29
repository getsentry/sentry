import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconNot} from 'sentry/icons';
import type {UserIdentityConfig} from 'sentry/types/auth';
import {UserIdentityCategory, UserIdentityStatus} from 'sentry/types/auth';
import type {InternalAppApiToken, User} from 'sentry/types/user';
import ApiTokenRow from 'sentry/views/settings/account/apiTokenRow';

import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';
import {prettyDate} from 'admin/utils';

type Props = {
  identities: UserIdentityConfig[];
  onAuthenticatorRemove: (auth: NonNullable<User['authenticators']>[number]) => void;
  onIdentityDisconnect: (identity: UserIdentityConfig) => void;
  revokeToken: (token: InternalAppApiToken) => void;
  tokens: InternalAppApiToken[];
  user: User;
};

function identityLabel(identity: UserIdentityConfig) {
  if (identity.category === UserIdentityCategory.ORG_IDENTITY) {
    return (
      <Link
        to={`/_admin/customers/${identity.organization!.slug}/`}
        style={{fontWeight: 'normal'}}
      >
        {identity.organization!.slug}
      </Link>
    );
  }

  let text: string;
  if (identity.category === UserIdentityCategory.GLOBAL_IDENTITY) {
    text = identity.isLogin ? 'Global Login' : 'App Integration';
  } else if (identity.category === UserIdentityCategory.SOCIAL_IDENTITY) {
    text = 'Legacy Integration';
  } else {
    throw new Error('Invalid category');
  }
  return <span style={{fontVariant: 'small-caps'}}>{text}</span>;
}

function UserOverview({
  user,
  identities,
  tokens = [],
  onAuthenticatorRemove,
  onIdentityDisconnect,
  revokeToken,
}: Props) {
  const sendgridFilters = [
    {val: [user.email], selectedFieldName: 'to_email', comparisonType: 'Is'},
  ];
  const sendgridUrl = `https://app.sendgrid.com/email_activity?filters=${encodeURIComponent(JSON.stringify(sendgridFilters))}`;
  const sentryUrl = `https://sentry.sentry.io/issues/?project=1&project=11276&query=${encodeURIComponent('user.email:' + user.email)}`;
  return (
    <DetailsContainer>
      <div>
        <DetailList>
          <DetailLabel title="Status">
            {user.isActive ? 'Active' : 'Disabled'}
          </DetailLabel>
          <DetailLabel title="Email">
            <ExternalLink href={`mailto:${user.email}`}>{user.email}</ExternalLink>
          </DetailLabel>
          <DetailLabel title="ID">{user.id}</DetailLabel>
          <DetailLabel title="Username">{user.username}</DetailLabel>
          <DetailLabel title="Managed" yesNo={user.isManaged} />
          <DetailLabel title="hasAuthPassword" yesNo={user.hasPasswordAuth} />
          <DetailLabel title="Joined">{moment(user.dateJoined).fromNow()}</DetailLabel>
          <DetailLabel title="Last Login">{moment(user.lastLogin).fromNow()}</DetailLabel>
          <DetailLabel title="Last Active">
            {user.lastActive ? moment(user.lastActive).fromNow() : null}
          </DetailLabel>
          <DetailLabel title="Logs">
            <ExternalLink href={sentryUrl}>Sentry</ExternalLink> |{' '}
            <ExternalLink href={sendgridUrl}>SendGrid</ExternalLink>
          </DetailLabel>
        </DetailList>
        <h6>Admin</h6>
        <DetailList>
          <DetailLabel title="Superuser" yesNo={user.isSuperuser} />
          <DetailLabel title="Staff" yesNo={user.isStaff} />
          <DetailLabel title="Permissions">
            {Array.from(user.permissions).map(p => (
              <Tag key={p}>{p}</Tag>
            ))}
          </DetailLabel>
        </DetailList>
      </div>
      <div>
        <h6>Identities</h6>
        {identities?.length ? (
          <DetailList>
            {identities.map(identity => (
              <DetailLabel key={identity.id} title={identity.provider.name}>
                <Flex justify="between">
                  <div>{identityLabel(identity)}</div>
                  <Button
                    icon={<IconNot />}
                    priority="danger"
                    size="xs"
                    title="Disconnect Identity"
                    onClick={() => onIdentityDisconnect(identity)}
                    aria-label="Disconnect Identity"
                    disabled={
                      identity.status !== UserIdentityStatus.CAN_DISCONNECT &&
                      identity.category !== UserIdentityCategory.ORG_IDENTITY
                    }
                  />
                </Flex>

                <small>{identity.name}</small>
                <br />
                {(identity.dateVerified || identity.dateAdded) && (
                  <small style={{color: '#999999'}}>
                    {identity.dateVerified
                      ? `Verified ${prettyDate(identity.dateVerified)}`
                      : `Added ${prettyDate(identity.dateAdded)}`}
                  </small>
                )}
              </DetailLabel>
            ))}
          </DetailList>
        ) : (
          <p>
            <em>
              <small>No identities linked.</small>
            </em>
          </p>
        )}
        <h6>Authenticators</h6>
        {user.authenticators?.length ? (
          <DetailList>
            {user.authenticators.map(auth => (
              <DetailLabel title={auth.type} key={auth.id}>
                <Flex justify="between">
                  <div>{auth.name}</div>
                  <Button
                    icon={<IconNot />}
                    priority="danger"
                    size="xs"
                    title="Remove Authenticator"
                    onClick={() => onAuthenticatorRemove(auth)}
                    aria-label="Remove Authenticator"
                  />
                </Flex>
                <small style={{color: '#999999'}}>
                  Last used {auth.dateUsed ? prettyDate(auth.dateUsed) : 'never'}
                </small>
              </DetailLabel>
            ))}
          </DetailList>
        ) : (
          <p>
            <em>
              <small>No authenticators attached.</small>
            </em>
          </p>
        )}
        <h6>Auth Tokens</h6>
        {tokens.length ? (
          <PanelTable headers={['Token', 'Created On', 'Scopes', '']}>
            {tokens.map(token => (
              <ApiTokenRow
                key={token.id}
                token={token}
                onRemove={revokeToken}
                onRemoveConfirmMessage="Are you sure you want to revoke this user's token? Doing so may break user's applications, and should usually only be done if the token has been leaked."
              />
            ))}
          </PanelTable>
        ) : (
          <p>
            <em>
              <small>No auth tokens created.</small>
            </em>
          </p>
        )}
      </div>
    </DetailsContainer>
  );
}

export default UserOverview;
