import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {
  InviteRow,
  NormalizedInvite,
} from 'sentry/components/modals/inviteMembersModal/types';
import {t} from 'sentry/locale';
import type {Member, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface Props {
  organization: Organization;
  initialData?: Partial<InviteRow>[];
  source?: string;
}
function defaultInvite(): InviteRow {
  return {
    emails: new Set<string>(),
    teams: new Set<string>(),
    role: 'member',
  };
}

function useLogInviteModalOpened({
  organization,
  sessionId,
  source,
}: {
  organization: Organization;
  sessionId: string;
  source: string | undefined;
}) {
  useEffect(() => {
    trackAnalytics('invite_modal.opened', {
      organization,
      modal_session: sessionId,
      can_invite: organization.access?.includes('member:write'),
      source,
    });
  }, [organization, sessionId, source]);
}

export default function useInviteModal({organization, initialData, source}: Props) {
  const api = useApi();
  const willInvite = organization.access?.includes('member:write');

  /**
   * Used for analytics tracking of the modals usage.
   */
  const sessionId = useRef(uniqueId());
  useLogInviteModalOpened({organization, sessionId: sessionId.current, source});

  const memberResult = useApiQuery<Member>(
    [`/organizations/${organization.slug}/members/me/`],
    {
      staleTime: 0,
    }
  );

  const [state, setState] = useState(() => {
    return {
      pendingInvites: initialData
        ? initialData.map(initial => ({
            ...defaultInvite(),
            ...initial,
          }))
        : [defaultInvite()],
      inviteStatus: {},
      complete: false,
      sendingInvites: false,
      error: undefined,
    };
  });

  const invites = useMemo(() => {
    return state.pendingInvites.reduce<NormalizedInvite[]>(
      (acc, row) =>
        acc.concat(
          Array.from(row.emails).map(email => ({email, teams: row.teams, role: row.role}))
        ),
      []
    );
  }, [state.pendingInvites]);

  const reset = useCallback(() => {
    setState({
      pendingInvites: [defaultInvite()],
      inviteStatus: {},
      complete: false,
      sendingInvites: false,
      error: undefined,
    });
    trackAnalytics('invite_modal.add_more', {
      organization,
      modal_session: sessionId.current,
    });
  }, [organization]);

  const sendInvite = useCallback(
    async (invite: NormalizedInvite) => {
      const data = {
        email: invite.email,
        teams: [...invite.teams],
        role: invite.role,
      };

      setState(prev => ({
        ...prev,
        inviteStatus: {
          ...prev.inviteStatus,
          [invite.email]: {sent: false},
        },
      }));

      const endpoint = willInvite
        ? `/organizations/${organization.slug}/members/`
        : `/organizations/${organization.slug}/invite-requests/`;

      try {
        await api.requestPromise(endpoint, {method: 'POST', data});
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

        const orgLevelError = errorResponse?.organization;
        const error = orgLevelError || emailError || t('Could not invite user');

        setState(prev => ({
          ...prev,
          inviteStatus: {...prev.inviteStatus, [invite.email]: {sent: false, error}},
          error: orgLevelError,
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        inviteStatus: {...prev.inviteStatus, [invite.email]: {sent: true}},
      }));
    },
    [api, organization, willInvite]
  );

  const sendInvites = useCallback(async () => {
    setState(prev => ({...prev, sendingInvites: true}));
    await Promise.all(invites.map(sendInvite));
    setState(prev => ({...prev, sendingInvites: false, complete: true}));

    trackAnalytics(
      willInvite ? 'invite_modal.invites_sent' : 'invite_modal.requests_sent',
      {
        organization,
        modal_session: sessionId.current,
      }
    );
  }, [organization, invites, sendInvite, willInvite]);

  const addInviteRow = useCallback(() => {
    setState(prev => ({
      ...prev,
      pendingInvites: [...prev.pendingInvites, defaultInvite()],
    }));
  }, []);

  const setEmails = useCallback((emails: string[], index: number) => {
    setState(prev => {
      const pendingInvites = [...prev.pendingInvites];
      pendingInvites[index] = {...pendingInvites[index], emails: new Set(emails)};

      return {...prev, pendingInvites};
    });
  }, []);

  const setTeams = useCallback((teams: string[], index: number) => {
    setState(prev => {
      const pendingInvites = [...prev.pendingInvites];
      pendingInvites[index] = {...pendingInvites[index], teams: new Set(teams)};

      return {...prev, pendingInvites};
    });
  }, []);

  const setRole = useCallback((role: string, index: number) => {
    setState(prev => {
      const pendingInvites = [...prev.pendingInvites];
      pendingInvites[index] = {...pendingInvites[index], role};

      return {...prev, pendingInvites};
    });
  }, []);

  const removeInviteRow = useCallback((index: number) => {
    setState(prev => {
      const pendingInvites = [...prev.pendingInvites];
      pendingInvites.splice(index, 1);
      return {...prev, pendingInvites};
    });
  }, []);

  return {
    addInviteRow,
    invites,
    memberResult,
    removeInviteRow,
    reset,
    sendInvites,
    sessionId: sessionId.current,
    setEmails,
    setRole,
    setTeams,
    willInvite,
    complete: state.complete,
    inviteStatus: state.inviteStatus,
    pendingInvites: state.pendingInvites,
    sendingInvites: state.sendingInvites,
    error: state.error,
  };
}
