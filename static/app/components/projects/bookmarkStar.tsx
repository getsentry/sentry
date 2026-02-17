import {useState} from 'react';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {update} from 'sentry/actionCreators/projects';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface BookmarkStarProps extends Omit<ButtonProps, 'as' | 'onToggle'> {
  organization: Organization;
  project: Project;
  onToggle?: (isBookmarked: boolean) => void;
}

export function BookmarkStar({
  organization,
  project,
  onToggle,
  tooltipProps,
  ...props
}: BookmarkStarProps) {
  const api = useApi({persistInFlight: true});
  const [isBookmarked, setIsBookmarked] = useState(project.isBookmarked);

  const {mutate: handleBookmarkToggle, isPending: isBookmarking} = useMutation({
    mutationFn: (variables: {isBookmarked: boolean}) => {
      return update(api, {
        orgId: organization.slug,
        projectId: project.slug,
        data: {isBookmarked: variables.isBookmarked},
      });
    },
    onMutate: variables => {
      onToggle?.(variables.isBookmarked);
      setIsBookmarked(variables.isBookmarked);
    },
    onError: (_data, variables) => {
      addErrorMessage(t('Unable to toggle bookmark for %s', project.slug));
      setIsBookmarked(!variables.isBookmarked);
    },
  });

  return (
    <Button
      tooltipProps={{
        ...tooltipProps,
        title: isBookmarked ? t('Remove Bookmark') : t('Bookmark'),
      }}
      aria-label={isBookmarked ? t('Remove Bookmark') : t('Bookmark')}
      aria-pressed={isBookmarked}
      busy={isBookmarking}
      onClick={() => handleBookmarkToggle({isBookmarked: !isBookmarked})}
      size="zero"
      priority="transparent"
      icon={
        <IconStar variant={isBookmarked ? 'warning' : 'muted'} isSolid={isBookmarked} />
      }
      {...props}
    />
  );
}
