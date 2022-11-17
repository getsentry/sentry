import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {ORG_ROLES} from 'sentry/constants';
import {IconAdd, IconCheckmark, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {uniqueId} from 'sentry/utils/guid';
import withLatestContext from 'sentry/utils/withLatestContext';

import InviteRowControl from './inviteRowControl';
import {InviteRow, InviteStatus, NormalizedInvite} from './types';

type Props = AsyncComponent['props'] &
  ModalRenderProps & {
    organization: Organization;
    initialData?: Partial<InviteRow>[];
    source?: string;
  };

type State = AsyncComponent['state'] & {
  complete: boolean;
  inviteStatus: InviteStatus;
  pendingInvites: InviteRow[];
  sendingInvites: boolean;
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
    trackAdvancedAnalyticsEvent('invite_modal.opened', {
      organization,
      modal_session: this.sessionId,
      can_invite: this.willInvite,
      source,
    });
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
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
    trackAdvancedAnalyticsEvent('invite_modal.add_more', {
      organization: this.props.organization,
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

    trackAdvancedAnalyticsEvent(
      this.willInvite ? 'invite_modal.invites_sent' : 'invite_modal.requests_sent',
      {
        organization: this.props.organization,
        modal_session: this.sessionId,
      }
    );
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
            ? t('Sending organization invitations\u2026')
            : t('Sending invite requests\u2026')}
        </StatusMessage>
      );
    }

    if (complete) {
      const statuses = Object.values(inviteStatus);
      const sentCount = statuses.filter(i => i.sent).length;
      const errorCount = statuses.filter(i => i.error).length;

      if (this.willInvite) {
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
      const inviteRequests = (
        <strong>{tn('%s invite request', '%s invite requests', sentCount)}</strong>
      );
      const tctComponents = {
        inviteRequests,
        failed: errorCount,
      };
      return (
        <StatusMessage status="success">
          <IconCheckmark size="sm" />
          {errorCount > 0
            ? tct(
                '[inviteRequests] pending approval, [failed] failed to send.',
                tctComponents
              )
            : tct('[inviteRequests] pending approval', tctComponents)}
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
    const {Footer, closeModal, organization} = this.props;
    const {pendingInvites, sendingInvites, complete, inviteStatus, member} = this.state;

    const disableInputs = sendingInvites || complete;

    // eslint-disable-next-line react/prop-types
    const hookRenderer: InviteModalRenderFunc = ({sendInvites, canSend, headerInfo}) => (
      <Fragment>
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
                `You don’t have permission to directly invite users, but we'll send a request to your organization owner and manager for review.`
              )}
        </Subtext>

        {headerInfo}

        <InviteeHeadings>
          <div>{t('Email addresses')}</div>
          <div>{t('Role')}</div>
          <div>{t('Add to team')}</div>
        </InviteeHeadings>

        <Rows>
          {pendingInvites.map(({emails, role, teams}, i) => (
            <StyledInviteRow
              key={i}
              disabled={disableInputs}
              emails={[...emails]}
              role={role}
              teams={[...teams]}
              roleOptions={member ? member.roles : ORG_ROLES}
              roleDisabledUnallowed={this.willInvite}
              inviteStatus={inviteStatus}
              onRemove={() => this.removeInviteRow(i)}
              onChangeEmails={opts => this.setEmails(opts?.map(v => v.value) ?? [], i)}
              onChangeRole={value => this.setRole(value?.value, i)}
              onChangeTeams={opts => this.setTeams(opts ? opts.map(v => v.value) : [], i)}
              disableRemove={disableInputs || pendingInvites.length === 1}
            />
          ))}
        </Rows>

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
              <Fragment>
                <Button data-test-id="send-more" size="sm" onClick={this.reset}>
                  {t('Send more invites')}
                </Button>
                <Button
                  data-test-id="close"
                  priority="primary"
                  size="sm"
                  onClick={() => {
                    trackAdvancedAnalyticsEvent('invite_modal.closed', {
                      organization: this.props.organization,
                      modal_session: this.sessionId,
                    });
                    closeModal();
                  }}
                >
                  {t('Close')}
                </Button>
              </Fragment>
            ) : (
              <Fragment>
                <Button
                  data-test-id="cancel"
                  size="sm"
                  onClick={closeModal}
                  disabled={disableInputs}
                >
                  {t('Cancel')}
                </Button>
                <Button
                  size="sm"
                  data-test-id="send-invites"
                  priority="primary"
                  disabled={!canSend || !this.isValidInvites || disableInputs}
                  onClick={sendInvites}
                >
                  {this.inviteButtonLabel}
                </Button>
              </Fragment>
            )}
          </FooterContent>
        </Footer>
      </Fragment>
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
  gap: ${space(1.5)};
  grid-auto-flow: column;
  align-items: center;
  font-weight: 400;
  font-size: ${p => p.theme.headerFontSize};
  margin-top: 0;
  margin-bottom: ${space(0.75)};
`;

const Subtext = styled('p')`
  color: ${p => p.theme.subText};
  margin-bottom: ${space(3)};
`;

const inviteRowGrid = css`
  display: grid;
  gap: ${space(1.5)};
  grid-template-columns: 3fr 180px 2fr max-content;
  align-items: start;
`;

const InviteeHeadings = styled('div')`
  ${inviteRowGrid};

  margin-bottom: ${space(1)};
  font-weight: 600;
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Rows = styled('ul')`
  list-style: none;
  padding: 0;
  margin: 0;
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
  gap: ${space(1)};
`;

const StatusMessage = styled('div')<{status?: 'success' | 'error'}>`
  display: grid;
  grid-template-columns: max-content max-content;
  gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => (p.status === 'error' ? p.theme.errorText : p.theme.textColor)};

  > :first-child {
    ${p => p.status === 'success' && `color: ${p.theme.successText}`};
  }
`;

export const modalCss = css`
  width: 100%;
  max-width: 800px;
  margin: 50px auto;
`;

export default withLatestContext(InviteMembersModal);
