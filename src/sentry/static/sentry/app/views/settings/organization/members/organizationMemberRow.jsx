import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from '../../../../locale';
import Avatar from '../../../../components/avatar';
import Button from '../../../../components/buttons/button';
import Confirm from '../../../../components/confirm';
import Link from '../../../../components/link';
import LoadingIndicator from '../../../../components/loadingIndicator';
import PanelItem from '../../components/panelItem';
import SentryTypes from '../../../../proptypes';
import Tooltip from '../../../../components/tooltip';
import recreateRoute from '../../../../utils/recreateRoute';

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
          <Avatar style={{width: 32, height: 32}} user={user ? user : {email}} />
        </Box>

        <Box pl={1} pr={2} flex="1">
          <h5 style={{margin: '0 0 3px'}}>
            <UserName to={detailsUrl}>{name}</UserName>
          </h5>
          <Email>{email}</Email>
        </Box>

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
                  <Button
                    priority="primary"
                    size="xsmall"
                    onClick={this.handleSendInvite}
                    style={{
                      padding: '0 4px',
                      marginTop: 2,
                    }}
                  >
                    {t('Resend invite')}
                  </Button>
                )}
            </div>
          ) : (
            <div>
              {!has2fa ? (
                <Tooltip title={t('Two-factor auth not enabled')}>
                  <span style={{color: '#B64236'}} className="icon-exclamation" />
                </Tooltip>
              ) : (
                <span style={{color: 'green'}} className="icon-check" />
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
                >
                  <span className="icon icon-trash" /> {t('Remove')}
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
