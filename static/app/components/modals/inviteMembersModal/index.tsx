import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {
  AsyncComponentProps,
  AsyncComponentState,
} from 'sentry/components/deprecatedAsyncComponent';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import HookOrDefault from 'sentry/components/hookOrDefault';
import InviteButton from 'sentry/components/modals/inviteMembersModal/inviteButton';
import InviteStatusMessage from 'sentry/components/modals/inviteMembersModal/inviteStatusMessage';
import {ORG_ROLES} from 'sentry/constants';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SentryPropTypeValidators} from 'sentry/sentryPropTypeValidators';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import withLatestContext from 'sentry/utils/withLatestContext';

import InviteRowControl from './inviteRowControl';
import {InviteRow, InviteStatus, NormalizedInvite} from './types';

export interface InviteMembersModalProps extends AsyncComponentProps, ModalRenderProps {
  organization: Organization;
  initialData?: Partial<InviteRow>[];
  source?: string;
}

interface State extends AsyncComponentState {
  complete: boolean;
  inviteStatus: InviteStatus;
  pendingInvites: InviteRow[];
  sendingInvites: boolean;
}

const DEFAULT_ROLE = 'member';

export const InviteModalHook = HookOrDefault({
  hookName: 'member-invite-modal:customization',
  defaultComponent: ({onSendInvites, children}) =>
    children({sendInvites: onSendInvites, canSend: true}),
});

export type InviteModalRenderFunc = React.ComponentProps<
  typeof InviteModalHook
>['children'];

class InviteMembersModal extends DeprecatedAsyncComponent<
  InviteMembersModalProps,
  State
> {
  static childContextTypes = {
    organization: SentryPropTypeValidators.isOrganization,
  };

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

  getChildContext() {
    // Expose organization via context to descendants
    // e.g. TeamSelector relies on it being present
    return {
      organization: this.props.organization,
    };
  }

  componentDidMount() {
    super.componentDidMount();
    this.sessionId = uniqueId();

    const {organization, source} = this.props;
    trackAnalytics('invite_modal.opened', {
      organization,
      modal_session: this.sessionId,
      can_invite: this.willInvite,
      source,
    });
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
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
    trackAnalytics('invite_modal.add_more', {
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

    trackAnalytics(
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

  get willInvite() {
    return this.props.organization.access?.includes('member:write');
  }

  render() {
    const {Footer, closeModal, organization} = this.props;
    const {pendingInvites, sendingInvites, complete, inviteStatus, member} = this.state;

    const disableInputs = sendingInvites || complete;

    const hookRenderer: InviteModalRenderFunc = ({sendInvites, canSend, headerInfo}) => (
      <Fragment>
        <Heading>{t('Invite New Members')}</Heading>
        {this.willInvite ? (
          <Subtext>{t('Invite new members by email to join your organization.')}</Subtext>
        ) : (
          <Alert type="warning" showIcon>
            {t(
              'You can’t invite users directly, but we’ll forward your request to an org owner or manager for approval.'
            )}
          </Alert>
        )}

        {headerInfo}

        <InviteeHeadings>
          <div>{t('Email addresses')}</div>
          <div>{t('Role')}</div>
          <div>{t('Add to team')}</div>
          <div />
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
          size="sm"
          borderless
          onClick={this.addInviteRow}
          icon={<IconAdd isCircled />}
        >
          {t('Add another')}
        </AddButton>

        <Footer>
          <FooterContent>
            <div>
              <InviteStatusMessage
                complete={this.state.complete}
                hasDuplicateEmails={this.hasDuplicateEmails}
                inviteStatus={this.state.inviteStatus}
                sendingInvites={this.state.sendingInvites}
                willInvite={this.willInvite}
              />
            </div>

            <ButtonBar gap={1}>
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
                      trackAnalytics('invite_modal.closed', {
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
                  <InviteButton
                    invites={this.invites}
                    willInvite={this.willInvite}
                    size="sm"
                    data-test-id="send-invites"
                    priority="primary"
                    disabled={!canSend || !this.isValidInvites || disableInputs}
                    onClick={sendInvites}
                  />
                </Fragment>
              )}
            </ButtonBar>
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
  grid-template-columns: 3fr 180px 2fr 0.5fr;
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
  display: flex;
  gap: ${space(1)};
  align-items: center;
  justify-content: space-between;
  flex: 1;
`;

export const modalCss = css`
  width: 100%;
  max-width: 900px;
  margin: 50px auto;
`;

export default withLatestContext(InviteMembersModal);
