import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';

export type ConsolePlatform = 'playstation' | 'xbox' | 'nintendo-switch';

export interface ConsoleSdkInviteUser {
  email: string;
  platforms: ConsolePlatform[];
  user_id: string;
}

export interface ConsoleSdkInviteDeleteItem {
  platform: ConsolePlatform;
  user_id: string;
}

interface UseRevokeConsoleSdkPlatformInviteParams {
  email: string;
  items: ConsoleSdkInviteDeleteItem[];
  orgSlug: string;
  platform: ConsolePlatform;
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
  return useMutation({
    mutationFn: ({orgSlug, items}: UseRevokeConsoleSdkPlatformInviteParams) => {
      return fetchMutation({
        method: 'DELETE',
        url: `/organizations/${orgSlug}/console-sdk-invites/`,
        data: {items},
      });
    },
    onMutate: ({email, platform}: UseRevokeConsoleSdkPlatformInviteParams) => {
      addLoadingMessage(tct('Removing [platform] access for [email]', {platform, email}));
    },
    onSuccess: (_data, {email, platform}: UseRevokeConsoleSdkPlatformInviteParams) => {
      addSuccessMessage(
        tct('Successfully removed [platform] access for [email]', {platform, email})
      );
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
    onSettled: (_data, _error, {orgSlug}: UseRevokeConsoleSdkPlatformInviteParams) => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgSlug}/console-sdk-invites/`],
      });
    },
  });
}
