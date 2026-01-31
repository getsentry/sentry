import {AvatarList} from '@sentry/scraps/avatar';

import Placeholder from 'sentry/components/placeholder';
import type {User} from 'sentry/types/user';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

type TResponseData = {
  data: {
    viewed_by: User[];
  };
};

interface Props {
  projectId: string;
  replayId: string;
}

export default function ReplayViewers({projectId, replayId}: Props) {
  const organization = useOrganization();

  const {projects} = useProjects();
  const project = projects.find(p => p.id === projectId);
  const projectSlug = project?.slug;

  const {data, isError, isPending} = useApiQuery<TResponseData>(
    [
      getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/viewed-by/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: projectSlug!,
            replayId,
          },
        }
      ),
    ],
    {
      staleTime: 0,
    }
  );

  return isPending || isError ? (
    <Placeholder width="25px" height="25px" />
  ) : (
    <AvatarList avatarSize={25} users={data?.data.viewed_by} />
  );
}
