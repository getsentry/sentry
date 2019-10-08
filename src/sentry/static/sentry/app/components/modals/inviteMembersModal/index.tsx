import React from 'react';
import styled, {css} from 'react-emotion';

import {t, tn, tct} from 'app/locale';
import {ModalRenderProps} from 'app/actionCreators/modal';
import InlineSvg from 'app/components/inlineSvg';
import Button from 'app/components/button';
import space from 'app/styles/space';
import AsyncComponent from 'app/components/asyncComponent';
import {Organization} from 'app/types';
import withLatestContext from 'app/utils/withLatestContext';
import LoadingIndicator from 'app/components/loadingIndicator';

import {InviteRow, InviteStatus, NormalizedInvite} from './types';
import InviteRowControl from './inviteRowControl';

type Props = AsyncComponent['props'] &
  ModalRenderProps & {
    organization: Organization;
  };

type State = AsyncComponent['state'] & {
  pendingInvites: InviteRow[];
  sendingInvites: boolean;
  complete: boolean;
  inviteStatus: InviteStatus;
};

const DEFAULT_ROLE = 'member';

class InviteMembersModal extends AsyncComponent<Props, State> {
  get inviteTemplate(): InviteRow {
    return {emails: new Set(), teams: new Set(), role: DEFAULT_ROLE};
  }

  getEndpoints(): [string, string][] {
    const orgId = this.props.organization.slug;

    // TODO(epurkhiser): For admins we cannot lookup me, and will not have
    // roles when viewing this modal as an admin. We need to add some hardcoded
    // defaults like in the old page.

    return [['member', `/organizations/${orgId}/members/me/`]];
  }

  getDefaultState() {
    const state = super.getDefaultState();
    return {
      ...state,
      pendingInvites: [this.inviteTemplate],
      inviteStatus: {},
      complete: false,
      sendingInvites: false,
    };
  }

  reset = () =>
    this.setState({
      pendingInvites: [this.inviteTemplate],
      inviteStatus: {},
      complete: false,
      sendingInvites: false,
    });

  sendInvite = async (invite: NormalizedInvite) => {
    const {slug} = this.props.organization;
    const data = {
      email: invite.email,
      teams: [...invite.teams],
      role: invite.role,
    };

    this.setState(state => ({
      inviteStatus: {...state.inviteStatus, [invite.email]: {sent: false}},
    }));

    try {
      await this.api.requestPromise(`/organizations/${slug}/members/`, {
        method: 'POST',
        data,
      });
    } catch (err) {
      const errorResponse = err.responseJSON;

      // Use the email error message if available. This inconsistently is
      // returned as either a list of errors for the field, or a single error.
      const emailError =
        !errorResponse || !errorResponse.email
          ? false
          : Array.isArray(errorResponse.email)
          ? errorResponse.email[0]
          : errorResponse.email;

      const error = emailError || t('Could not invite user');

      this.setState(state => ({
        inviteStatus: {...state.inviteStatus, [invite.email]: {sent: false, error}},
      }));
      return;
    }

    this.setState(state => ({
      inviteStatus: {...state.inviteStatus, [invite.email]: {sent: true}},
    }));
  };

  sendInvites = async () => {
    this.setState({sendingInvites: true});
    await Promise.all(this.invites.map(this.sendInvite));
    this.setState({sendingInvites: false, complete: true});
  };

  addInviteRow = () =>
    this.setState(state => ({
      pendingInvites: [...state.pendingInvites, this.inviteTemplate],
    }));

  setEmails(emails: string[], index: number) {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites[index] = {...pendingInvites[index], emails: new Set(emails)};

      return {pendingInvites};
    });
  }

  setTeams(teams: string[], index: number) {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites[index] = {...pendingInvites[index], teams: new Set(teams)};

      return {pendingInvites};
    });
  }

  setRole(role: string, index: number) {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites[index] = {...pendingInvites[index], role};

      return {pendingInvites};
    });
  }

  removeInviteRow(index: number) {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites.splice(index, 1);
      return {pendingInvites};
    });
  }

  get invites(): NormalizedInvite[] {
    return this.state.pendingInvites.reduce<NormalizedInvite[]>(
      (acc, row) => [
        ...acc,
        ...[...row.emails].map(email => ({email, teams: row.teams, role: row.role})),
      ],
      []
    );
  }

  get hasDuplicateEmails() {
    const emails = this.invites.map(inv => inv.email);
    return emails.length !== new Set(emails).size;
  }

  get isValidInvites() {
    return this.invites.length > 0 && !this.hasDuplicateEmails;
  }

  get statusMessage() {
    const {sendingInvites, complete, inviteStatus} = this.state;

    if (sendingInvites) {
      return (
        <StatusMessage>
          <LoadingIndicator mini relative hideMessage size={16} />
          {t('Sending organization invitations...')}
        </StatusMessage>
      );
    }

    if (complete) {
      const statuses = Object.values(inviteStatus);
      const sentCount = statuses.filter(i => i.sent).length;
      const errorCount = statuses.filter(i => i.error).length;

      const invites = <strong>{tn('%d invite', '%d invites', sentCount)}</strong>;

      return (
        <StatusMessage status="success">
          <InlineSvg src="icon-checkmark-sm" size="16px" />
          {errorCount > 0
            ? tct('Sent [invites], [failed] failed to send.', {
                invites,
                failed: errorCount,
              })
            : tct('Sent [invites]', {invites})}
        </StatusMessage>
      );
    }

    if (this.hasDuplicateEmails) {
      return (
        <StatusMessage status="error">
          <InlineSvg src="icon-warning-sm" size="16px" />
          {t('Duplicate emails between invite rows.')}
        </StatusMessage>
      );
    }

    return null;
  }

  render() {
    const {Footer, closeModal, organization} = this.props;
    const {pendingInvites, sendingInvites, complete, inviteStatus, member} = this.state;

    const disableInputs = sendingInvites || complete;

    return (
      <React.Fragment>
        <Heading>
          <InlineSvg src="icon-mail" size="36px" />
          {t('Invite New Members')}
        </Heading>
        <Subtext>
          {t('Invite new members by email invitation to join your Organization.')}
        </Subtext>

        <InviteeHeadings>
          <div>{t('Email addresses')}</div>
          <div>{t('Role')}</div>
          <div>{t('Add to team')}</div>
        </InviteeHeadings>

        {pendingInvites.map(({emails, role, teams}, i) => (
          <StyledInviteRow
            key={i}
            disabled={disableInputs}
            emails={[...emails]}
            role={role}
            teams={[...teams]}
            roleOptions={member && member.roles}
            teamOptions={organization.teams}
            inviteStatus={inviteStatus}
            onRemove={() => this.removeInviteRow(i)}
            onChangeEmails={opts => this.setEmails(opts.map(v => v.value), i)}
            onChangeRole={({value}) => this.setRole(value, i)}
            onChangeTeams={opts => this.setTeams(opts.map(v => v.value), i)}
            disableRemove={disableInputs || pendingInvites.length === 1}
          />
        ))}

        <AddButton
          disabled={disableInputs}
          priority="link"
          onClick={this.addInviteRow}
          icon="icon-circle-add"
        >
          {t('Add another')}
        </AddButton>

        <Footer>
          <FooterContent>
            <div>{this.statusMessage}</div>

            {complete ? (
              <React.Fragment>
                <Button data-test-id="send-more" size="small" onClick={this.reset}>
                  {t('Send more invites')}
                </Button>
                <Button
                  data-test-id="close"
                  priority="primary"
                  size="small"
                  onClick={closeModal}
                >
                  {t('Close')}
                </Button>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <Button
                  data-test-id="cancel"
                  size="small"
                  onClick={closeModal}
                  disabled={disableInputs}
                >
                  {t('Cancel')}
                </Button>
                <Button
                  size="small"
                  data-test-id="send-invites"
                  priority="primary"
                  disabled={!this.isValidInvites || disableInputs}
                  onClick={this.sendInvites}
                >
                  {this.invites.length > 0
                    ? tn('Send invite', 'Send invites (%d)', this.invites.length)
                    : t('Send invites')}
                </Button>
              </React.Fragment>
            )}
          </FooterContent>
        </Footer>
      </React.Fragment>
    );
  }
}

const Heading = styled('h1')`
  display: grid;
  grid-gap: ${space(1.5)};
  grid-template-columns: max-content 1fr;
  align-items: center;
  font-weight: 400;
  font-size: ${p => p.theme.headerFontSize};
  margin-top: 0;
  margin-bottom: ${space(0.75)};
`;

const Subtext = styled('p')`
  color: ${p => p.theme.gray3};
  margin-bottom: ${space(3)};
`;

const inviteRowGrid = css`
  display: grid;
  grid-gap: ${space(1.5)};
  grid-template-columns: 3fr 180px 2fr max-content;
`;

const InviteeHeadings = styled('div')`
  ${inviteRowGrid};

  margin-bottom: ${space(1)};
  font-weight: 600;
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledInviteRow = styled(InviteRowControl)`
  ${inviteRowGrid};
  margin-bottom: ${space(1.5)};
`;

const AddButton = styled(Button)`
  margin-top: ${space(3)};
`;

const FooterContent = styled('div')`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr max-content max-content;
  grid-gap: ${space(1)};
`;

const StatusMessage = styled('div')<{status?: 'success' | 'error'}>`
  display: grid;
  grid-template-columns: max-content max-content;
  grid-gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};

  color: ${p => (p.status === 'error' ? p.theme.red : p.theme.gray3)};

  ${p =>
    p.status === 'success' &&
    css`
      ${InlineSvg} {
        color: ${p.theme.green};
      }
    `};
`;

const modalClassName = css`
  padding: 50px;

  .modal-dialog {
    position: unset;
    width: 100%;
    max-width: 800px;
    margin: 50px auto;
  }
`;
export {modalClassName};
export default withLatestContext(InviteMembersModal);
