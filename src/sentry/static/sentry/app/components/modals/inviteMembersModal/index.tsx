import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {t, tn, tct} from 'app/locale';
import {MEMBER_ROLES} from 'app/constants';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {uniqueId} from 'app/utils/guid';
import {IconCheckmark, IconWarning, IconAdd} from 'app/icons';
import Button from 'app/components/button';
import HookOrDefault from 'app/components/hookOrDefault';
import QuestionTooltip from 'app/components/questionTooltip';
import space from 'app/styles/space';
import AsyncComponent from 'app/components/asyncComponent';
import {Organization, Team} from 'app/types';
import withLatestContext from 'app/utils/withLatestContext';
import withTeams from 'app/utils/withTeams';
import LoadingIndicator from 'app/components/loadingIndicator';

import {InviteRow, InviteStatus, NormalizedInvite} from './types';
import InviteRowControl from './inviteRowControl';

type Props = AsyncComponent['props'] &
  ModalRenderProps & {
    organization: Organization;
    teams: Team[];
    source?: string;
    initialData?: Partial<InviteRow>[];
  };

type State = AsyncComponent['state'] & {
  pendingInvites: InviteRow[];
  sendingInvites: boolean;
  complete: boolean;
  inviteStatus: InviteStatus;
};

const DEFAULT_ROLE = 'member';

const InviteModalHook = HookOrDefault({
  hookName: 'member-invite-modal:customization',
  defaultComponent: ({onSendInvites, children}) =>
    children({sendInvites: onSendInvites, canSend: true}),
});

type InviteModalRenderFunc = React.ComponentProps<typeof InviteModalHook>['children'];

class InviteMembersModal extends AsyncComponent<Props, State> {
  get inviteTemplate(): InviteRow {
    return {
      emails: new Set(),
      teams: new Set(),
      role: DEFAULT_ROLE,
    };
  }

  /**
   * Used for analytics tracking of the modals usage.
   */
  sessionId = '';

  componentDidMount() {
    this.sessionId = uniqueId();

    const {organization, source} = this.props;

    trackAnalyticsEvent({
      eventKey: 'invite_modal.opened',
      eventName: 'Invite Modal: Opened',
      organization_id: organization.id,
      modal_session: this.sessionId,
      can_invite: this.willInvite,
      source,
    });
  }

  getEndpoints(): [string, string][] {
    const orgId = this.props.organization.slug;

    return [['member', `/organizations/${orgId}/members/me/`]];
  }

  getDefaultState() {
    const state = super.getDefaultState();
    const {initialData} = this.props;

    const pendingInvites = initialData
      ? initialData.map(initial => ({
          ...this.inviteTemplate,
          ...initial,
        }))
      : [this.inviteTemplate];

    return {
      ...state,
      pendingInvites,
      inviteStatus: {},
      complete: false,
      sendingInvites: false,
    };
  }

  reset = () => {
    this.setState({
      pendingInvites: [this.inviteTemplate],
      inviteStatus: {},
      complete: false,
      sendingInvites: false,
    });

    trackAnalyticsEvent({
      eventKey: 'invite_modal.add_more',
      eventName: 'Invite Modal: Add More',
      organization_id: this.props.organization.id,
      modal_session: this.sessionId,
    });
  };

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

    const endpoint = this.willInvite
      ? `/organizations/${slug}/members/`
      : `/organizations/${slug}/invite-requests/`;

    try {
      await this.api.requestPromise(endpoint, {method: 'POST', data});
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

    trackAnalyticsEvent({
      eventKey: this.willInvite
        ? 'invite_modal.invites_sent'
        : 'invite_modal.requests_sent',
      eventName: this.willInvite
        ? 'Invite Modal: Invites Sent'
        : 'Invite Modal: Requests Sent',
      organization_id: this.props.organization.id,
      modal_session: this.sessionId,
    });
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
          {this.willInvite
            ? t('Sending organization invitations...')
            : t('Sending invite requests...')}
        </StatusMessage>
      );
    }

    if (complete) {
      const statuses = Object.values(inviteStatus);
      const sentCount = statuses.filter(i => i.sent).length;
      const errorCount = statuses.filter(i => i.error).length;

      const invites = <strong>{tn('%s invite', '%s invites', sentCount)}</strong>;
      const tctComponents = {
        invites,
        failed: errorCount,
      };

      return (
        <StatusMessage status="success">
          <IconCheckmark size="sm" />
          {errorCount > 0
            ? tct('Sent [invites], [failed] failed to send.', tctComponents)
            : tct('Sent [invites]', tctComponents)}
        </StatusMessage>
      );
    }

    if (this.hasDuplicateEmails) {
      return (
        <StatusMessage status="error">
          <IconWarning size="sm" />
          {t('Duplicate emails between invite rows.')}
        </StatusMessage>
      );
    }

    return null;
  }

  get willInvite() {
    return this.props.organization.access?.includes('member:write');
  }

  get inviteButtonLabel() {
    if (this.invites.length > 0) {
      const numberInvites = this.invites.length;

      // Note we use `t()` here because `tn()` expects the same # of string formatters
      const inviteText =
        numberInvites === 1 ? t('Send invite') : t('Send invites (%s)', numberInvites);
      const requestText =
        numberInvites === 1
          ? t('Send invite request')
          : t('Send invite requests (%s)', numberInvites);

      return this.willInvite ? inviteText : requestText;
    }

    return this.willInvite ? t('Send invite') : t('Send invite request');
  }

  render() {
    const {Footer, closeModal, organization, teams: allTeams} = this.props;
    const {pendingInvites, sendingInvites, complete, inviteStatus, member} = this.state;

    const disableInputs = sendingInvites || complete;

    // eslint-disable-next-line react/prop-types
    const hookRenderer: InviteModalRenderFunc = ({sendInvites, canSend, headerInfo}) => (
      <React.Fragment>
        <Heading>
          {t('Invite New Members')}
          {!this.willInvite && (
            <QuestionTooltip
              title={t(
                `You do not have permission to directly invite members. Email
                 addresses entered here will be forwarded to organization
                 managers and owners; they will be prompted to approve the
                 invitation.`
              )}
              size="sm"
              position="bottom"
            />
          )}
        </Heading>
        <Subtext>
          {this.willInvite
            ? t('Invite new members by email to join your organization.')
            : t(
                `You don’t have permission to directly invite users, but we’ll
                 send a request on your behalf.`
              )}
        </Subtext>

        {headerInfo}

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
            roleOptions={member ? member.roles : MEMBER_ROLES}
            roleDisabledUnallowed={this.willInvite}
            teamOptions={allTeams}
            inviteStatus={inviteStatus}
            onRemove={() => this.removeInviteRow(i)}
            onChangeEmails={opts =>
              this.setEmails(
                opts.map(v => v.value),
                i
              )
            }
            onChangeRole={({value}) => this.setRole(value, i)}
            onChangeTeams={opts =>
              this.setTeams(
                opts.map(v => v.value),
                i
              )
            }
            disableRemove={disableInputs || pendingInvites.length === 1}
          />
        ))}

        <AddButton
          disabled={disableInputs}
          priority="link"
          onClick={this.addInviteRow}
          icon={<IconAdd size="xs" isCircled />}
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
                  onClick={() => {
                    trackAnalyticsEvent({
                      eventKey: 'invite_modal.closed',
                      eventName: 'Invite Modal: Closed',
                      organization_id: this.props.organization.id,
                      modal_session: this.sessionId,
                    });
                    closeModal();
                  }}
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
                  disabled={!canSend || !this.isValidInvites || disableInputs}
                  onClick={sendInvites}
                >
                  {this.inviteButtonLabel}
                </Button>
              </React.Fragment>
            )}
          </FooterContent>
        </Footer>
      </React.Fragment>
    );

    return (
      <InviteModalHook
        organization={organization}
        willInvite={this.willInvite}
        onSendInvites={this.sendInvites}
      >
        {hookRenderer}
      </InviteModalHook>
    );
  }
}

const Heading = styled('h1')`
  display: inline-grid;
  grid-gap: ${space(1.5)};
  grid-auto-flow: column;
  align-items: center;
  font-weight: 400;
  font-size: ${p => p.theme.headerFontSize};
  margin-top: 0;
  margin-bottom: ${space(0.75)};
`;

const Subtext = styled('p')`
  color: ${p => p.theme.gray600};
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
  color: ${p => (p.status === 'error' ? p.theme.red400 : p.theme.gray600)};

  > :first-child {
    ${p => p.status === 'success' && `color: ${p.theme.green300}`};
  }
`;

export const modalCss = css`
  padding: 50px;

  .modal-dialog {
    position: unset;
    width: 100%;
    max-width: 800px;
    margin: 50px auto;
  }
`;

export default withLatestContext(withTeams(InviteMembersModal));
