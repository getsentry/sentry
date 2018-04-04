import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {PanelItem} from '../../../../components/panels';
import {t, tct} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import UserBadge from '../../../../components/userBadge';
import Confirm from '../../../../components/confirm';
import InlineSvg from '../../../../components/inlineSvg';
import LoadingIndicator from '../../../../components/loadingIndicator';
import SentryTypes from '../../../../proptypes';
import Tooltip from '../../../../components/tooltip';
import space from '../../../../styles/space';

export default class OrganizationMemberRow extends React.PureComponent {
  static propTypes = {
    // XXX: Spreading this does not work :(
    member: SentryTypes.Member,
    onRemove: PropTypes.func.isRequired,
    onLeave: PropTypes.func.isRequired,
    onSendInvite: PropTypes.func.isRequired,
    orgName: PropTypes.string.isRequired,
    orgId: PropTypes.string,
    memberCanLeave: PropTypes.bool,
    requireLink: PropTypes.bool,
    canRemoveMembers: PropTypes.bool,
    canAddMembers: PropTypes.bool,
    currentUser: SentryTypes.User,
    status: PropTypes.oneOf(['', 'loading', 'success', 'error']),
  };

  constructor(...args) {
    super(...args);
    this.state = {busy: false};
  }

  handleRemove = e => {
    let {onRemove} = this.props;

    if (typeof onRemove !== 'function') return;

    this.setState({busy: true});
    onRemove(this.props.member, e);
  };

  handleLeave = e => {
    let {onLeave} = this.props;

    if (typeof onLeave !== 'function') return;

    this.setState({busy: true});
    onLeave(this.props.member, e);
  };

  handleSendInvite = e => {
    let {onSendInvite} = this.props;

    if (typeof onSendInvite !== 'function') return;

    onSendInvite(this.props.member, e);
  };

  render() {
    let {
      member,
      orgName,
      orgId,
      status,
      requireLink,
      memberCanLeave,
      currentUser,
      canRemoveMembers,
      canAddMembers,
    } = this.props;

    let {flags, email, name, roleName, pending, user} = member;

    // if member is not the only owner, they can leave
    let needsSso = !flags['sso:linked'] && requireLink;
    let isCurrentUser = currentUser.email === email;
    let showRemoveButton = !isCurrentUser;
    let showLeaveButton = isCurrentUser;
    let canRemoveMember = canRemoveMembers && !isCurrentUser;
    // member has a `user` property if they are registered with sentry
    // i.e. has accepted an invite to join org
    let has2fa = user && user.has2fa;
    let isInviteSuccessful = status === 'success';
    let isInviting = status === 'loading';

    return (
      <PanelItem align="center" p={0} py={2}>
        <StyledUserBadge avatarSize={36} user={user} orgId={orgId} />

        <Box px={2} w={180}>
          {needsSso || pending ? (
            <div>
              <div>
                {pending ? (
                  <strong>{t('Invited')}</strong>
                ) : (
                  <strong>{t('Missing SSO Link')}</strong>
                )}
              </div>

              {isInviting && (
                <div style={{padding: '4px 0 3px'}}>
                  <LoadingIndicator mini />
                </div>
              )}
              {isInviteSuccessful && <span>Sent!</span>}
              {!isInviting &&
                !isInviteSuccessful &&
                canAddMembers &&
                (pending || needsSso) && (
                  <ResendInviteButton
                    priority="primary"
                    size="xsmall"
                    onClick={this.handleSendInvite}
                  >
                    {t('Resend invite')}
                  </ResendInviteButton>
                )}
            </div>
          ) : (
            <div>
              {!has2fa ? (
                <Tooltip title={t('Two-factor auth not enabled')}>
                  <NoTwoFactorIcon />
                </Tooltip>
              ) : (
                <HasTwoFactorIcon />
              )}
            </div>
          )}
        </Box>

        <Box px={2} w={140}>
          {roleName}
        </Box>

        {showRemoveButton || showLeaveButton ? (
          <Box px={2} w={140}>
            {showRemoveButton &&
              canRemoveMember && (
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
                  <Button icon="icon-circle-subtract" size="small" busy={this.state.busy}>
                    {t('Remove')}
                  </Button>
                </Confirm>
              )}

            {showRemoveButton &&
              !canRemoveMember && (
                <Button
                  disabled
                  size="small"
                  title={t('You do not have access to remove member')}
                  icon="icon-circle-subtract"
                >
                  {t('Remove')}
                </Button>
              )}

            {showLeaveButton &&
              memberCanLeave && (
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
                  <Button priority="danger" size="small" busy={this.state.busy}>
                    <span className="icon icon-exit" /> {t('Leave')}
                  </Button>
                </Confirm>
              )}

            {showLeaveButton &&
              !memberCanLeave && (
                <Button
                  size="small"
                  disabled
                  title={t(
                    'You cannot leave the organization as you are the only owner.'
                  )}
                >
                  <span className="icon icon-exit" /> {t('Leave')}
                </Button>
              )}
          </Box>
        ) : null}
      </PanelItem>
    );
  }
}

const NoTwoFactorIcon = styled(props => (
  <InlineSvg {...props} src="icon-circle-exclamation" />
))`
  color: ${p => p.theme.error};
  font-size: 18px;
`;

const HasTwoFactorIcon = styled(props => (
  <InlineSvg {...props} src="icon-circle-check" />
))`
  color: ${p => p.theme.success};
  font-size: 18px;
`;

const ResendInviteButton = styled(Button)`
  padding: 0 4px;
  margin-top: 2px;
`;

const StyledUserBadge = styled(UserBadge)`
  padding: 0 ${space(2)};
  flex-grow: 1;
`;
