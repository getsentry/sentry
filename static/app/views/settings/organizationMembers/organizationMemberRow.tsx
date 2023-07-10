import {Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {OrgRoleInfo} from 'sentry/components/orgRole';
import {PanelItem} from 'sentry/components/panels';
import {IconCheckmark, IconClose, IconFlag, IconMail, IconSubtract} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AvatarUser, Member, Organization} from 'sentry/types';
import isMemberDisabledFromLimit from 'sentry/utils/isMemberDisabledFromLimit';

type Props = {
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  currentUser: AvatarUser;
  member: Member;
  memberCanLeave: boolean;
  onLeave: (member: Member) => void;
  onRemove: (member: Member) => void;
  onSendInvite: (member: Member) => void;
  organization: Organization;
  requireLink: boolean;
  status: '' | 'loading' | 'success' | 'error' | null;
};

type State = {
  busy: boolean;
};

const DisabledMemberTooltip = HookOrDefault({
  hookName: 'component:disabled-member-tooltip',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

export default class OrganizationMemberRow extends PureComponent<Props, State> {
  state: State = {
    busy: false,
  };

  handleRemove = () => {
    const {onRemove} = this.props;

    if (typeof onRemove !== 'function') {
      return;
    }

    this.setState({busy: true});
    onRemove(this.props.member);
  };

  handleLeave = () => {
    const {onLeave} = this.props;

    if (typeof onLeave !== 'function') {
      return;
    }

    this.setState({busy: true});
    onLeave(this.props.member);
  };

  handleSendInvite = () => {
    const {onSendInvite, member} = this.props;

    if (typeof onSendInvite !== 'function') {
      return;
    }
    onSendInvite(member);
  };

  renderMemberRole() {
    const {member, organization} = this.props;
    const {roleName, pending, expired} = member;
    if (isMemberDisabledFromLimit(member)) {
      return <DisabledMemberTooltip>{t('Deactivated')}</DisabledMemberTooltip>;
    }
    if (pending) {
      return (
        <InvitedRole>
          <IconMail size="md" />
          {expired ? t('Expired Invite') : tct('Invited [roleName]', {roleName})}
        </InvitedRole>
      );
    }
    return <OrgRoleInfo member={member} organization={organization} />;
  }

  render() {
    const {
      member,
      organization,
      status,
      requireLink,
      memberCanLeave,
      currentUser,
      canRemoveMembers,
      canAddMembers,
    } = this.props;

    const {id, flags, email, name, pending, user} = member;

    // if member is not the only owner, they can leave
    const isIdpProvisioned = flags['idp:provisioned'];
    const needsSso = !flags['sso:linked'] && requireLink;
    const isCurrentUser = currentUser.email === email;
    const showRemoveButton = !isCurrentUser;
    const showLeaveButton = isCurrentUser;
    const canRemoveMember = canRemoveMembers && !isCurrentUser && !isIdpProvisioned;
    // member has a `user` property if they are registered with sentry
    // i.e. has accepted an invite to join org
    const has2fa = user && user.has2fa;
    const detailsUrl = `/settings/${organization.slug}/members/${id}/`;
    const isInviteSuccessful = status === 'success';
    const isInviting = status === 'loading';
    const showResendButton = pending || needsSso;

    return (
      <StyledPanelItem data-test-id={email}>
        <MemberHeading>
          <UserAvatar
            size={32}
            user={user ?? {email, id: email, name: email, type: 'user'}}
          />
          <MemberDescription to={detailsUrl}>
            <h5 style={{margin: '0 0 3px'}}>
              <UserName>{name}</UserName>
            </h5>
            <Email>{email}</Email>
          </MemberDescription>
        </MemberHeading>

        <div data-test-id="member-role">{this.renderMemberRole()}</div>

        <div data-test-id="member-status">
          {showResendButton ? (
            <Fragment>
              {isInviting && (
                <LoadingContainer>
                  <LoadingIndicator mini />
                </LoadingContainer>
              )}
              {isInviteSuccessful && <span>{t('Sent!')}</span>}
              {!isInviting && !isInviteSuccessful && (
                <Button
                  disabled={!canAddMembers}
                  priority="primary"
                  size="sm"
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
          <RightColumn>
            {showRemoveButton && canRemoveMember && (
              <Confirm
                message={tct('Are you sure you want to remove [name] from [orgName]?', {
                  name,
                  orgName: organization.slug,
                })}
                onConfirm={this.handleRemove}
              >
                <Button
                  data-test-id="remove"
                  icon={<IconSubtract isCircled size="xs" />}
                  size="sm"
                  busy={this.state.busy}
                >
                  {t('Remove')}
                </Button>
              </Confirm>
            )}

            {showRemoveButton && !canRemoveMember && (
              <Button
                disabled
                size="sm"
                title={
                  isIdpProvisioned
                    ? t(
                        "This user is managed through your organization's identity provider."
                      )
                    : t('You do not have access to remove members')
                }
                icon={<IconSubtract isCircled size="xs" />}
              >
                {t('Remove')}
              </Button>
            )}

            {showLeaveButton && memberCanLeave && (
              <Confirm
                message={tct('Are you sure you want to leave [orgName]?', {
                  orgName: organization.slug,
                })}
                onConfirm={this.handleLeave}
              >
                <Button priority="danger" size="sm" icon={<IconClose size="xs" />}>
                  {t('Leave')}
                </Button>
              </Confirm>
            )}

            {showLeaveButton && !memberCanLeave && (
              <Button
                size="sm"
                icon={<IconClose size="xs" />}
                disabled
                title={
                  isIdpProvisioned
                    ? t(
                        "Your account is managed through your organization's identity provider."
                      )
                    : t(
                        'You cannot leave this organization as you are the only organization owner.'
                      )
                }
              >
                {t('Leave')}
              </Button>
            )}
          </RightColumn>
        ) : null}
      </StyledPanelItem>
    );
  }
}

const StyledPanelItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: minmax(150px, 4fr) minmax(90px, 2fr) minmax(120px, 2fr) minmax(
      100px,
      1fr
    );
  gap: ${space(2)};
  align-items: center;
`;
// Force action button at the end to align to right
const RightColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const Section = styled('div')`
  display: inline-grid;
  grid-template-columns: max-content auto;
  gap: ${space(1)};
  align-items: center;
`;

const MemberHeading = styled(Section)``;
const MemberDescription = styled(Link)`
  overflow: hidden;
`;

const UserName = styled('div')`
  display: block;
  overflow: hidden;
  font-size: ${p => p.theme.fontSizeMedium};
  text-overflow: ellipsis;
`;

const Email = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  overflow: hidden;
  text-overflow: ellipsis;
`;

const InvitedRole = styled(Section)``;
const LoadingContainer = styled('div')`
  margin-top: 0;
  margin-bottom: ${space(1.5)};
`;

const AuthStatus = styled(Section)``;
