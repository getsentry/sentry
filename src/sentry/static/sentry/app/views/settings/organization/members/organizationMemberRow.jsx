import PropTypes from 'prop-types';
import React from 'react';

import {t, tct} from '../../../../locale';
import Avatar from '../../../../components/avatar';
import Button from '../../../../components/buttons/button';
import Confirm from '../../../../components/confirm';
import Link from '../../../../components/link';
import LoadingIndicator from '../../../../components/loadingIndicator';
import SentryTypes from '../../../../proptypes';

export default class OrganizationMemberRow extends React.PureComponent {
  static propTypes = {
    // XXX: Spreading this does not work :(
    member: SentryTypes.Member,
    onRemove: PropTypes.func.isRequired,
    onLeave: PropTypes.func.isRequired,
    onSendInvite: PropTypes.func.isRequired,
    orgId: PropTypes.string.isRequired,
    orgName: PropTypes.string.isRequired,
    memberCanLeave: PropTypes.bool,
    requireLink: PropTypes.bool,
    canRemoveMembers: PropTypes.bool,
    canAddMembers: PropTypes.bool,
    currentUser: SentryTypes.User,
    status: PropTypes.oneOf(['loading', 'success', 'error'])
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
      orgId,
      orgName,
      status,
      requireLink,
      memberCanLeave,
      currentUser,
      canRemoveMembers,
      canAddMembers
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
    let detailsUrl = `/organizations/${orgId}/members/${id}/`;
    let isInviteSuccessful = status === 'success';
    let isInviting = status === 'loading';

    return (
      <tr key={id}>
        <td className="table-user-info">
          <Avatar
            user={
              user
                ? user
                : {
                    email
                  }
            }
          />
          <h5>
            <Link to={detailsUrl}>
              {name}
            </Link>
          </h5>
          {email}
          <br />
        </td>

        <td className="status">
          {needsSso || pending
            ? <div>
                <div>
                  {pending
                    ? <strong>{t('Invited')}</strong>
                    : <strong>{t('Missing SSO Link')}</strong>}
                </div>

                {isInviting &&
                  <div style={{padding: '4px 0 3px'}}><LoadingIndicator mini /></div>}
                {isInviteSuccessful && <span>Sent!</span>}
                {!isInviting &&
                  !isInviteSuccessful &&
                  canAddMembers &&
                  (pending || needsSso) &&
                  <Button
                    priority="primary"
                    size="xsmall"
                    onClick={this.handleSendInvite}
                    style={{
                      padding: '0 4px',
                      marginTop: 2
                    }}>
                    {t('Resend invite')}
                  </Button>}
              </div>
            : !has2fa
                ? <span
                    style={{color: '#B64236'}}
                    className="icon-exclamation tip"
                    title={t('Two-factor auth not enabled')}
                  />
                : null}
        </td>

        <td className="squash">{roleName}</td>
        {canRemoveMembers || memberCanLeave
          ? <td className="align-right squash">
              <Button
                style={{marginRight: 4}}
                size="small"
                to={`/organizations/${orgId}/members/${id}/`}>
                {t('Details')}
              </Button>

              {showRemoveButton &&
                canRemoveMember &&
                <Confirm
                  message={tct('Are you sure you want to remove [name] from [orgName]?', {
                    name,
                    orgName
                  })}
                  onConfirm={this.handleRemove}
                  onSuccess={tct('Removed [name] from [orgName]', {
                    name,
                    orgName
                  })}
                  onError={tct('Error removing [name] from [orgName]', {
                    name,
                    orgName
                  })}>
                  <Button priority="danger" size="small" busy={this.state.busy}>
                    <span className="icon icon-trash" /> {t('Remove')}
                  </Button>
                </Confirm>}

              {showRemoveButton &&
                !canRemoveMember &&
                <Button
                  disabled
                  size="small"
                  title={t('You do not have access to remove member')}>
                  <span className="icon icon-trash" /> {t('Remove')}
                </Button>}

              {showLeaveButton &&
                memberCanLeave &&
                <Confirm
                  message={tct('Are you sure you want to leave [orgName]?', {
                    orgName
                  })}
                  onConfirm={this.handleLeave}
                  onSuccess={tct('Left [orgName]', {
                    orgName
                  })}
                  onError={tct('Error leaving [orgName]', {
                    orgName
                  })}>
                  <Button priority="danger" size="small" busy={this.state.busy}>
                    <span className="icon icon-exit" /> {t('Leave')}
                  </Button>
                </Confirm>}

              {showLeaveButton &&
                !memberCanLeave &&
                <Button
                  size="small"
                  disabled
                  title={t(
                    'You cannot leave the organization as you are the only owner.'
                  )}>
                  <span className="icon icon-exit" /> {t('Leave')}
                </Button>}
            </td>
          : null}
      </tr>
    );
  }
}
