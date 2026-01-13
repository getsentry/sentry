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

export interface ConsoleSdkInviteUser {
  email: string;
  platforms: ConsolePlatform[];
  user_id: string;
}

interface UseRevokeConsoleSdkInviteParams {
  email: string;
  orgSlug: string;
  userId: string;
  onSuccess?: () => void;
  platforms?: ConsolePlatform[];
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
    mutationFn: ({orgSlug, userId, platforms}: UseRevokeConsoleSdkInviteParams) => {
      return fetchMutation({
        method: 'DELETE',
        url: `/organizations/${orgSlug}/console-sdk-invites/`,
        data: {
          user_id: userId,
          ...(platforms && platforms.length > 0 ? {platforms} : {}),
        },
      });
    },
    onMutate: ({email, platforms}: UseRevokeConsoleSdkInviteParams) => {
      const message = platforms
        ? tct('Removing [platforms] access for [email]', {
            platforms: platforms.join(', '),
            email,
          })
        : tct('Removing console SDK access for [email]', {email});
      addLoadingMessage(message);
    },
    onSuccess: (
      _data,
      {email, orgSlug, platforms, onSuccess}: UseRevokeConsoleSdkInviteParams
    ) => {
      const message = platforms
        ? tct('Successfully removed [platforms] access for [email]', {
            platforms: platforms.join(', '),
            email,
          })
        : tct('Successfully removed console SDK access for [email]', {email});
      addSuccessMessage(message);
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgSlug}/console-sdk-invites/`],
      });
      onSuccess?.();
    },
    onError: (_error, {email, platforms}: UseRevokeConsoleSdkInviteParams) => {
      const message = platforms
        ? tct('Failed to remove [platforms] access for [email]', {
            platforms: platforms.join(', '),
            email,
          })
        : tct('Failed to remove console SDK access for [email]', {email});
      addErrorMessage(message);
    },
  });
}
