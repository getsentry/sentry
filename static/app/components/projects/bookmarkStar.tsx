import {useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {update} from 'sentry/actionCreators/projects';
import {Button} from 'sentry/components/button';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type Props = {
  organization: Organization;
  project: Project;
  className?: string;
  onToggle?: (isBookmarked: boolean) => void;
};

function BookmarkStar({className, organization, project, onToggle}: Props) {
  const api = useApi({persistInFlight: true});
  const [isBookmarked, setIsBookmarked] = useState(project.isBookmarked);

  const {mutate: handleBookmarkToggle, isPending: isBookmarking} = useMutation({
    mutationFn: () => {
      return update(api, {
        orgId: organization.slug,
        projectId: project.slug,
        data: {isBookmarked: !isBookmarked},
      });
    },
    onMutate: () => {
      onToggle?.(isBookmarked);
      setIsBookmarked(current => !current);
    },
    onError: () => {
      addErrorMessage(t('Unable to toggle bookmark for %s', project.slug));
      setIsBookmarked(current => !current);
    },
  });

  const label = isBookmarked ? t('Remove Bookmark') : t('Bookmark');

  return (
    <BookmarkStarButton
      title={label}
      aria-label={label}
      aria-pressed={isBookmarked}
      busy={isBookmarking}
      onClick={() => handleBookmarkToggle()}
      size="zero"
      borderless
      className={className}
      icon={
        <IconStar color={isBookmarked ? 'yellow300' : 'subText'} isSolid={isBookmarked} />
      }
    />
  );
}

const BookmarkStarButton = styled(Button)`
  border-radius: 50%;
  width: 24px;
  height: 24px;
  margin: -${space(0.5)};

  svg {
    /* Negative margin for visual centering within the button */
    margin-top: -1px;
  }
`;

export default BookmarkStar;
