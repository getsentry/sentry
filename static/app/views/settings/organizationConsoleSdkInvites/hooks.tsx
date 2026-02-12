import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ConsolePlatform} from 'sentry/constants/consolePlatforms';
import {tct} from 'sentry/locale';
import {
  fetchMutation,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

export interface ConsoleSdkInviteUser {
  email: string;
  memberId: string;
  platforms: ConsolePlatform[];
  userId: string;
}

interface ConsoleSdkInviteDeleteItem {
  memberId: string;
  platform: ConsolePlatform;
}

interface UseRevokeConsoleSdkPlatformInviteParams {
  items: ConsoleSdkInviteDeleteItem[];
  orgSlug: string;
  email?: string;
  platform?: ConsolePlatform;
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
    mutationFn: ({orgSlug, items}: UseRevokeConsoleSdkPlatformInviteParams) => {
      return fetchMutation({
        method: 'DELETE',
        url: `/organizations/${orgSlug}/console-sdk-invites/`,
        data: {items},
      });
    },
    onMutate: ({email, platform}: UseRevokeConsoleSdkPlatformInviteParams) => {
      if (email && platform) {
        addLoadingMessage(
          tct('Removing [platform] access for [email]', {platform, email})
        );
      }
    },
    onSuccess: (_data, {email, platform}: UseRevokeConsoleSdkPlatformInviteParams) => {
      if (email && platform) {
        addSuccessMessage(
          tct('Successfully removed [platform] access for [email]', {platform, email})
        );
      }
    },
    onError: (
      error: RequestError,
      {email, platform}: UseRevokeConsoleSdkPlatformInviteParams
    ) => {
      if (email && platform) {
        const rawDetail = error.responseJSON?.detail;
        const detail =
          typeof rawDetail === 'string'
            ? rawDetail
            : (rawDetail?.message ??
              tct('Failed to remove [platform] access for [email]', {platform, email}));
        addErrorMessage(detail);
      }
    },
    onSettled: (_data, _error, {orgSlug}: UseRevokeConsoleSdkPlatformInviteParams) => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgSlug}/console-sdk-invites/`],
      });
    },
  });
}
