import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {tct} from 'sentry/locale';
import {
  fetchMutation,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';

type ConsolePlatform = 'playstation' | 'xbox' | 'nintendo-switch';

interface ConsoleSdkInviteUser {
  email: string;
  platforms: ConsolePlatform[];
  user_id: string;
}

interface UseRevokeConsoleSdkInviteParams {
  email: string;
  orgSlug: string;
  userId: string;
  onSuccess?: () => void;
}

export function useConsoleSdkInvites(orgSlug: string) {
  return useApiQuery<ConsoleSdkInviteUser[]>(
    [`/organizations/${orgSlug}/console-sdk-invites/`],
    {
      staleTime: 5000,
    }
  );
}

export function useRevokeConsoleSdkInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({orgSlug, userId}: UseRevokeConsoleSdkInviteParams) => {
      return fetchMutation({
        method: 'DELETE',
        url: `/organizations/${orgSlug}/console-sdk-invites/`,
        data: {user_id: userId},
      });
    },
    onMutate: ({email}: UseRevokeConsoleSdkInviteParams) => {
      addLoadingMessage(tct('Removing console SDK access for [email]', {email}));
    },
    onSuccess: (_data, {email, orgSlug}: UseRevokeConsoleSdkInviteParams) => {
      addSuccessMessage(
        tct('Successfully removed console SDK access for [email]', {email})
      );
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgSlug}/console-sdk-invites/`],
      });
    },
    onError: (_error, {email}: UseRevokeConsoleSdkInviteParams) => {
      addErrorMessage(tct('Failed to remove console SDK access for [email]', {email}));
    },
  });
}
