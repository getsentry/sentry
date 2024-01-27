import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {
  AsyncComponentProps,
  AsyncComponentState,
} from 'sentry/components/deprecatedAsyncComponent';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import InviteMembersModalView from 'sentry/components/modals/inviteMembersModal/inviteMembersModalview';
import type {
  InviteRow,
  InviteStatus,
  NormalizedInvite,
} from 'sentry/components/modals/inviteMembersModal/types';
import {InviteModalHook} from 'sentry/components/modals/memberInviteModalCustomization';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import withOrganization from 'sentry/utils/withOrganization';

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

class InviteMembersModal extends DeprecatedAsyncComponent<
  InviteMembersModalProps,
  State
> {
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

  setEmails = (emails: string[], index: number) => {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites[index] = {...pendingInvites[index], emails: new Set(emails)};

      return {pendingInvites};
    });
  };

  setTeams = (teams: string[], index: number) => {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites[index] = {...pendingInvites[index], teams: new Set(teams)};

      return {pendingInvites};
    });
  };

  setRole = (role: string, index: number) => {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites[index] = {...pendingInvites[index], role};

      return {pendingInvites};
    });
  };

  removeInviteRow = (index: number) => {
    this.setState(state => {
      const pendingInvites = [...state.pendingInvites];
      pendingInvites.splice(index, 1);
      return {pendingInvites};
    });
  };

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
    const {closeModal, Footer, organization} = this.props;
    const {complete, inviteStatus, member, pendingInvites, sendingInvites} = this.state;

    return (
      <InviteModalHook
        organization={organization}
        willInvite={this.willInvite}
        onSendInvites={this.sendInvites}
      >
        {({sendInvites, canSend, headerInfo}) => {
          return (
            <InviteMembersModalView
              addInviteRow={this.addInviteRow}
              canSend={canSend}
              closeModal={closeModal}
              complete={complete}
              Footer={Footer}
              hasDuplicateEmails={this.hasDuplicateEmails}
              headerInfo={headerInfo}
              invites={this.invites}
              inviteStatus={inviteStatus}
              member={member}
              organization={organization}
              pendingInvites={pendingInvites}
              removeInviteRow={this.removeInviteRow}
              reset={this.reset}
              sendingInvites={sendingInvites}
              sendInvites={sendInvites}
              sessionId={this.sessionId}
              setEmails={this.setEmails}
              setRole={this.setRole}
              setTeams={this.setTeams}
              willInvite={this.willInvite}
              isValidInvites={this.isValidInvites}
            />
          );
        }}
      </InviteModalHook>
    );
  }
}

export const modalCss = css`
  width: 100%;
  max-width: 900px;
  margin: 50px auto;
`;

export default withOrganization(InviteMembersModal);
