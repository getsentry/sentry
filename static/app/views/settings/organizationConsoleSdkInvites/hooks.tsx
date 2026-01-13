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
  platform: ConsolePlatform;
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
      platform,
    }: UseRevokeConsoleSdkPlatformInviteParams) => {
      return fetchMutation({
        method: 'DELETE',
        url: `/organizations/${orgSlug}/console-sdk-invites/`,
        data: {user_id: userId, platforms: [platform]},
      });
    },
    onMutate: ({email, platform}: UseRevokeConsoleSdkPlatformInviteParams) => {
      addLoadingMessage(tct('Removing [platform] access for [email]', {platform, email}));
    },
    onSuccess: (
      _data,
      {email, platform, orgSlug}: UseRevokeConsoleSdkPlatformInviteParams
    ) => {
      addSuccessMessage(
        tct('Successfully removed [platform] access for [email]', {platform, email})
      );
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgSlug}/console-sdk-invites/`],
      });
    },
    onError: (
      error: RequestError,
      {email, platform}: UseRevokeConsoleSdkPlatformInviteParams
    ) => {
      const rawDetail = error.responseJSON?.detail;
      const detail =
        typeof rawDetail === 'string'
          ? rawDetail
          : (rawDetail?.message ??
            tct('Failed to remove [platform] access for [email]', {platform, email}));
      addErrorMessage(detail);
    },
  });
}
