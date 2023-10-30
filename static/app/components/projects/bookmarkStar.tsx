import {useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {update} from 'sentry/actionCreators/projects';
import {Button} from 'sentry/components/button';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

type Props = {
  organization: Organization;
  project: Project;
  className?: string;
  onToggle?: (isBookmarked: boolean) => void;
};

function BookmarkStar({className, organization, project, onToggle}: Props) {
  const api = useApi();
  const [isBookmarked, setIsBookmarked] = useState(project.isBookmarked);

  const handleBookmarkToggle = (event: React.MouseEvent) => {
    // prevent dropdowns from closing
    event.stopPropagation();

    update(api, {
      orgId: organization.slug,
      projectId: project.slug,
      data: {isBookmarked: !isBookmarked},
    }).catch(() => addErrorMessage(t('Unable to toggle bookmark for %s', project.slug)));

    setIsBookmarked(current => !current);
    onToggle?.(!isBookmarked);
  };

  return (
    <BookmarkStarButton
      aria-label={t('Bookmark Project')}
      aria-pressed={isBookmarked}
      onClick={handleBookmarkToggle}
      size="zero"
      borderless
      className={className}
      icon={
        <IconStar color={isBookmarked ? 'yellow400' : 'subText'} isSolid={isBookmarked} />
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
