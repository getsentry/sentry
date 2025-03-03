import {createContext, useContext} from 'react';

import type {
  InviteRow,
  InviteStatus,
  NormalizedInvite,
} from 'sentry/components/modals/inviteMembersModal/types';

export type InviteMembersContextValue = {
  complete: boolean;
  inviteStatus: InviteStatus;
  invites: NormalizedInvite[];
  isOverMemberLimit: boolean;
  pendingInvites: InviteRow;
  reset: () => void;
  sendInvites: () => void;
  sendingInvites: boolean;
  setEmails: (emails: string[], index: number) => void;
  setInviteStatus: (inviteStatus: InviteStatus) => void;
  setRole: (role: string, index: number) => void;
  setTeams: (teams: string[], index: number) => void;
  willInvite: boolean;
  error?: string;
};

export const defaultInviteProps: InviteMembersContextValue = {
  complete: false,
  inviteStatus: {},
  invites: [],
  isOverMemberLimit: false,
  pendingInvites: {
    emails: new Set<string>(),
    role: '',
    teams: new Set<string>(),
  },
  reset: () => {},
  sendInvites: () => {},
  sendingInvites: false,
  setEmails: () => {},
  setRole: () => {},
  setTeams: () => {},
  setInviteStatus: () => {},
  willInvite: false,
};

export const InviteMembersContext = createContext<InviteMembersContextValue | null>(null);

export function useInviteMembersContext(): InviteMembersContextValue {
  const context = useContext(InviteMembersContext);

  if (!context) {
    throw new Error(
      'useInviteMembersContext must be used within a InviteMembersContext.Provider'
    );
  }

  return context;
}
