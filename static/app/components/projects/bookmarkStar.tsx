import {useState} from 'react';
import {IconStar} from '@sentry/icons/star';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

import {useUpdateProjectBookmark} from './useUpdateProjectBookmark';

interface BookmarkStarProps extends Omit<
  ButtonProps,
  'as' | 'onToggle' | 'tooltipProps'
> {
  organization: Organization;
  project: Project;
  onToggle?: (isBookmarked: boolean) => void;
  /**
   * Called once the bookmark request finishes, whether it succeeded or failed. The
   * projects store holds the final bookmark state by then.
   */
  onToggleSettled?: () => void;
  tooltipProps?: Omit<NonNullable<ButtonProps['tooltipProps']>, 'title'>;
}

export function BookmarkStarIcon({isBookmarked}: {isBookmarked: boolean}) {
  return <IconStar variant={isBookmarked ? 'warning' : 'muted'} isSolid={isBookmarked} />;
}

export function BookmarkStar({
  organization,
  project,
  onToggle,
  onToggleSettled,
  tooltipProps,
  ...props
}: BookmarkStarProps) {
  const [isBookmarked, setIsBookmarked] = useState(project.isBookmarked);

  const {mutate: handleBookmarkToggle, isPending: isBookmarking} =
    useUpdateProjectBookmark({
      organization,
      onMutate: variables => {
        onToggle?.(variables.isBookmarked);
        setIsBookmarked(variables.isBookmarked);
      },
      onError: variables => setIsBookmarked(!variables.isBookmarked),
      onSettled: () => onToggleSettled?.(),
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
      onClick={() => handleBookmarkToggle({project, isBookmarked: !isBookmarked})}
      size="zero"
      variant="transparent"
      icon={<BookmarkStarIcon isBookmarked={isBookmarked} />}
      {...props}
    />
  );
}
