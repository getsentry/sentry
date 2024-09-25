import {createContext} from 'react';

import type {
  InviteRow,
  InviteStatus,
  NormalizedInvite,
} from 'sentry/components/modals/inviteMembersModal/types';

export type InviteMembersContextProps = {
  complete: boolean;
  inviteStatus: InviteStatus;
  invites: NormalizedInvite[];
  pendingInvites: InviteRow[];
  reset: () => void;
  sendInvites: () => void;
  sendingInvites: boolean;
  setEmails: (emails: string[], index: number) => void;
  setRole: (role: string, index: number) => void;
  setTeams: (teams: string[], index: number) => void;
  willInvite: boolean;
  error?: string;
};

export const InviteMembersContext = createContext<InviteMembersContextProps | undefined>(
  undefined
);
