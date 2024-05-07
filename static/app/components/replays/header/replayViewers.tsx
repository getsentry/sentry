import AvatarList from 'sentry/components/avatar/avatarList';
import HeaderPlaceholder from 'sentry/components/replays/header/headerPlaceholder';
import type {User} from 'sentry/types/user';
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
  const url = `/projects/${organization.slug}/${projectSlug}/replays/${replayId}/viewed-by/`;

  const {data, isError, isLoading} = useApiQuery<TResponseData>([url], {
    staleTime: 0,
  });

  return isLoading || isError ? (
    <HeaderPlaceholder width="55px" height="27px" />
  ) : (
    <AvatarList avatarSize={25} users={data?.data.viewed_by} />
  );
}
