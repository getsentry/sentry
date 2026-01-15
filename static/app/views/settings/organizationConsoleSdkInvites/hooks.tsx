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

interface UseRevokeConsoleSdkPlatformInviteParams {
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
    onSuccess: (_data, {orgSlug}: UseRevokeConsoleSdkPlatformInviteParams) => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgSlug}/console-sdk-invites/`],
      });
    },
  });
}
