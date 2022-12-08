import {useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {update} from 'sentry/actionCreators/projects';
import Button from 'sentry/components/button';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
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
    <Button
      aria-label={t('Bookmark Project')}
      aria-pressed={isBookmarked}
      onClick={handleBookmarkToggle}
      size="zero"
      priority="link"
      className={className}
      icon={
        <IconStar color={isBookmarked ? 'yellow400' : 'subText'} isSolid={isBookmarked} />
      }
    />
  );
}

export default BookmarkStar;
