import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {CONSOLE_PLATFORM_METADATA} from 'sentry/constants/consolePlatforms';
import {
  fetchMutation,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

type ConsolePlatform = 'playstation' | 'xbox' | 'nintendo-switch';

export interface ConsoleSdkInviteUser {
  email: string;
  platforms: ConsolePlatform[];
  user_id: string;
}

interface UseRevokeConsoleSdkPlatformInviteParams {
  email: string;
  orgSlug: string;
  platforms: ConsolePlatform[];
  userId: string;
}

export function useConsoleSdkInvites(orgSlug: string) {
  return useApiQuery<ConsoleSdkInviteUser[]>(
    [`/organizations/${orgSlug}/console-sdk-invites/`],
    {
      staleTime: 5000,
    }
  );
}

export function useRevokeConsoleSdkPlatformInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orgSlug,
      userId,
      platforms,
    }: UseRevokeConsoleSdkPlatformInviteParams) => {
      return fetchMutation({
        method: 'DELETE',
        url: `/organizations/${orgSlug}/console-sdk-invites/`,
        data: {user_id: userId, platforms},
      });
    },
    onSuccess: (
      _data,
      {email, orgSlug, platforms}: UseRevokeConsoleSdkPlatformInviteParams
    ) => {
      const platformNames = platforms
        .map(p => CONSOLE_PLATFORM_METADATA[p]?.displayName ?? p)
        .join(', ');
      addSuccessMessage(`Successfully removed ${platformNames} access from ${email}`);
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgSlug}/console-sdk-invites/`],
      });
    },
    onError: (error: RequestError) => {
      const rawDetail = error.responseJSON?.detail;
      const detail =
        typeof rawDetail === 'string'
          ? rawDetail
          : (rawDetail?.message ?? 'Failed to revoke console SDK access');
      addErrorMessage(detail);
    },
  });
}
