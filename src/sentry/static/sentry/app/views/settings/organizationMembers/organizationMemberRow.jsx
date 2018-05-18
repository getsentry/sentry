import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import Avatar from 'app/components/avatar';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes from 'app/proptypes';
import Tooltip from 'app/components/tooltip';
import recreateRoute from 'app/utils/recreateRoute';
import {conditionalGuideAnchor} from 'app/components/assistant/guideAnchor';

const UserName = styled(Link)`
  font-size: 16px;
`;

const Email = styled.div`
  color: ${p => p.theme.gray3};
  font-size: 14px;
`;

export default class OrganizationMemberRow extends React.PureComponent {
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
    firstRow: PropTypes.bool,
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

    let {id, flags, email, name, roleName, pending, user} = member;

    // if member is not the only owner, they can leave
    let needsSso = !flags['sso:linked'] && requireLink;
    let isCurrentUser = currentUser.email === email;
    let showRemoveButton = !isCurrentUser;
    let showLeaveButton = isCurrentUser;
    let canRemoveMember = canRemoveMembers && !isCurrentUser;
    // member has a `user` property if they are registered with sentry
    // i.e. has accepted an invite to join org
    let has2fa = user && user.has2fa;
    let detailsUrl = recreateRoute(id, {routes, params});
    let isInviteSuccessful = status === 'success';
    let isInviting = status === 'loading';

    return (
      <PanelItem align="center" p={0} py={2}>
        <Box pl={2}>
          <Avatar size={32} user={user ? user : {id: email, email}} />
        </Box>

        <Box pl={1} pr={2} flex="1">
          <h5 style={{margin: '0 0 3px'}}>
            <UserName to={detailsUrl}>{name}</UserName>
          </h5>
          <Email>{email}</Email>
        </Box>

        <Box px={2} w={180}>
          {conditionalGuideAnchor(
            this.props.firstRow,
            'member_status',
            'text',
            needsSso || pending ? (
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
            )
          )}
        </Box>

        <Box px={2} w={140}>
          {conditionalGuideAnchor(this.props.firstRow, 'member_role', 'text', roleName)}
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
