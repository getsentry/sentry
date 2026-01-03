import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
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
  onSuccess?: () => void;
  userId?: string;
}

export function useConsoleSdkInvites(orgSlug: string) {
  return useApiQuery<ConsoleSdkInviteUser[]>(
    [`/organizations/${orgSlug}/console-sdk-invites/`],
    {
      staleTime: Infinity,
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
      addLoadingMessage(`Removing console SDK access for ${email}`);
    },
    onSuccess: (_data, {email, orgSlug, onSuccess}: UseRevokeConsoleSdkInviteParams) => {
      addSuccessMessage(`Successfully removed console SDK access for ${email}`);
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgSlug}/console-sdk-invites/`],
      });
      onSuccess?.();
    },
    onError: (_error, {email}: UseRevokeConsoleSdkInviteParams) => {
      addErrorMessage(`Failed to remove console SDK access for ${email}`);
    },
  });
}
