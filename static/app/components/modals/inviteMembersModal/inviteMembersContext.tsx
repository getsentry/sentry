import {createContext} from 'react';
import {
  InviteRow,
  InviteStatus,
  NormalizedInvite,
} from 'sentry/components/modals/inviteMembersModal/types';

export type InviteMembersContextProps = {
  willInvite: boolean;
  invites: NormalizedInvite[];
  setEmails: (emails: string[], index: number) => void;
  setRole: (role: string, index: number) => void;
  setTeams: (teams: string[], index: number) => void;
  sendInvites: () => void;
  reset: () => void;
  inviteStatus: InviteStatus;
  pendingInvites: InviteRow[];
  sendingInvites: boolean;
  complete: boolean;
  error?: string;
};

export const InviteMembersContext = createContext<InviteMembersContextProps | undefined>(
  undefined
);
