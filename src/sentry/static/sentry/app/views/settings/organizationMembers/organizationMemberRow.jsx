import PropTypes from 'prop-types';
import {PureComponent, Fragment} from 'react';
import styled from '@emotion/styled';

import {PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import UserAvatar from 'app/components/avatar/userAvatar';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconClose, IconCheckmark, IconFlag, IconMail, IconSubtract} from 'app/icons';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import recreateRoute from 'app/utils/recreateRoute';

export default class OrganizationMemberRow extends PureComponent {
  static propTypes = {
    routes: PropTypes.array,
    // XXX: Spreading this does not work :(
    member: SentryTypes.Member,
    onRemove: PropTypes.func.isRequired,
    onLeave: PropTypes.func.isRequired,
    onSendInvite: PropTypes.func.isRequired,
    orgName: PropTypes.string.isRequired,
    memberCanLeave: PropTypes.bool,
    requireLink: PropTypes.bool,
    canRemoveMembers: PropTypes.bool,
    canAddMembers: PropTypes.bool,
    currentUser: SentryTypes.User,
    status: PropTypes.oneOf(['', 'loading', 'success', 'error']),
  };

  state = {busy: false};

  handleRemove = e => {
    const {onRemove} = this.props;

    if (typeof onRemove !== 'function') {
      return;
    }

    this.setState({busy: true});
    onRemove(this.props.member, e);
  };

  handleLeave = e => {
    const {onLeave} = this.props;

    if (typeof onLeave !== 'function') {
      return;
    }

    this.setState({busy: true});
    onLeave(this.props.member, e);
  };

  handleSendInvite = e => {
    const {onSendInvite, member} = this.props;

    if (typeof onSendInvite !== 'function') {
      return;
    }

    onSendInvite(member, e);
  };

  render() {
    const {
      params,
      routes,
      member,
      orgName,
      status,
      requireLink,
      memberCanLeave,
      currentUser,
      canRemoveMembers,
      canAddMembers,
    } = this.props;

    const {id, flags, email, name, roleName, pending, expired, user} = member;

    // if member is not the only owner, they can leave
    const needsSso = !flags['sso:linked'] && requireLink;
    const isCurrentUser = currentUser.email === email;
    const showRemoveButton = !isCurrentUser;
    const showLeaveButton = isCurrentUser;
    const canRemoveMember = canRemoveMembers && !isCurrentUser;
    // member has a `user` property if they are registered with sentry
    // i.e. has accepted an invite to join org
    const has2fa = user && user.has2fa;
    const detailsUrl = recreateRoute(id, {routes, params});
    const isInviteSuccessful = status === 'success';
    const isInviting = status === 'loading';
    const showResendButton = pending || needsSso;

    return (
      <StyledPanelItem data-test-id={email}>
        <MemberHeading>
          <UserAvatar size={32} user={user ? user : {id: email, email}} />
          <MemberDescription to={detailsUrl}>
            <h5 style={{margin: '0 0 3px'}}>
              <UserName>{name}</UserName>
            </h5>
            <Email>{email}</Email>
          </MemberDescription>
        </MemberHeading>

        <div data-test-id="member-role">
          {pending ? (
            <InvitedRole>
              <IconMail size="md" />
              {expired ? t('Expired Invite') : tct('Invited [roleName]', {roleName})}
            </InvitedRole>
          ) : (
            roleName
          )}
        </div>

        <div data-test-id="member-status">
          {showResendButton ? (
            <Fragment>
              {isInviting && (
                <LoadingContainer>
                  <LoadingIndicator mini />
                </LoadingContainer>
              )}
              {isInviteSuccessful && <span>Sent!</span>}
              {!isInviting && !isInviteSuccessful && (
                <Button
                  disabled={!canAddMembers}
                  priority="primary"
                  size="small"
                  onClick={this.handleSendInvite}
                >
                  {pending ? t('Resend invite') : t('Resend SSO link')}
                </Button>
              )}
            </Fragment>
          ) : (
            <AuthStatus>
              {has2fa ? (
                <IconCheckmark isCircled color="success" />
              ) : (
                <IconFlag color="error" />
              )}
              {has2fa ? t('2FA Enabled') : t('2FA Not Enabled')}
            </AuthStatus>
          )}
        </div>

        {showRemoveButton || showLeaveButton ? (
          <div>
            {showRemoveButton && canRemoveMember && (
              <Confirm
                message={tct('Are you sure you want to remove [name] from [orgName]?', {
                  name,
                  orgName,
                })}
                onConfirm={this.handleRemove}
                onSuccess={tct('Removed [name] from [orgName]', {
                  name,
                  orgName,
                })}
                onError={tct('Error removing [name] from [orgName]', {
                  name,
                  orgName,
                })}
              >
                <Button
                  data-test-id="remove"
                  icon={<IconSubtract isCircled size="xs" />}
                  size="small"
                  busy={this.state.busy}
                >
                  {t('Remove')}
                </Button>
              </Confirm>
            )}

            {showRemoveButton && !canRemoveMember && (
              <Button
                disabled
                size="small"
                title={t('You do not have access to remove members')}
                icon={<IconSubtract isCircled size="xs" />}
              >
                {t('Remove')}
              </Button>
            )}

            {showLeaveButton && memberCanLeave && (
              <Confirm
                message={tct('Are you sure you want to leave [orgName]?', {
                  orgName,
                })}
                onConfirm={this.handleLeave}
                onSuccess={tct('Left [orgName]', {
                  orgName,
                })}
                onError={tct('Error leaving [orgName]', {
                  orgName,
                })}
              >
                <Button priority="danger" size="small" icon={<IconClose size="xs" />}>
                  {t('Leave')}
                </Button>
              </Confirm>
            )}

            {showLeaveButton && !memberCanLeave && (
              <Button
                size="small"
                icon={<IconClose size="xs" />}
                disabled
                title={t(
                  'You cannot leave this organization as you are the only organization owner.'
                )}
              >
                {t('Leave')}
              </Button>
            )}
          </div>
        ) : null}
      </StyledPanelItem>
    );
  }
}

const StyledPanelItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: minmax(150px, 2fr) minmax(90px, 1fr) minmax(120px, 1fr) 90px;
  grid-gap: ${space(2)};
  align-items: center;
`;

const Section = styled('div')`
  display: inline-grid;
  grid-template-columns: max-content auto;
  grid-gap: ${space(1)};
  align-items: center;
`;

const MemberHeading = styled(Section)``;
const MemberDescription = styled(Link)`
  overflow: hidden;
`;

const UserName = styled('div')`
  display: block;
  font-size: ${p => p.theme.fontSizeLarge};
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Email = styled('div')`
  color: ${p => p.theme.gray700};
  font-size: ${p => p.theme.fontSizeMedium};
  overflow: hidden;
  text-overflow: ellipsis;
`;

const InvitedRole = styled(Section)``;
const LoadingContainer = styled('div')`
  margin-top: 0;
  margin-bottom: ${space(1.5)};
`;

const AuthStatus = styled(Section)``;
