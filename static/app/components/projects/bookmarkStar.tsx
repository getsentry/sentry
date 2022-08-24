import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {update} from 'sentry/actionCreators/projects';
import Button from 'sentry/components/button';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';

type Props = {
  organization: Organization;
  project: Project;
  className?: string;
  /**
   * Allows the bookmarked state of the project to be overridden. Useful for
   * optimistic updates.
   */
  isBookmarked?: boolean;
  onToggle?: (isBookmarked: boolean) => void;
};

const BookmarkStar = styled(
  ({
    isBookmarked: isBookmarkedProp,
    className,
    organization,
    project,
    onToggle,
  }: Props) => {
    const api = useApi();

    const isBookmarked = defined(isBookmarkedProp)
      ? isBookmarkedProp
      : project.isBookmarked;

    const toggleProjectBookmark = (event: React.MouseEvent) => {
      update(api, {
        orgId: organization.slug,
        projectId: project.slug,
        data: {isBookmarked: !isBookmarked},
      }).catch(() =>
        addErrorMessage(t('Unable to toggle bookmark for %s', project.slug))
      );

      // prevent dropdowns from closing
      event.stopPropagation();

      onToggle?.(!isBookmarked);
    };

    return (
      <Button
        aria-label="Bookmark Project"
        aria-pressed={isBookmarked}
        onClick={toggleProjectBookmark}
        size="zero"
        priority="link"
        className={className}
        icon={
          <IconStar
            color={isBookmarked ? 'yellow300' : 'subText'}
            isSolid={isBookmarked}
          />
        }
      />
    );
  }
)`
  &:hover svg {
    fill: ${p =>
      p.project.isBookmarked || p.isBookmarked ? p.theme.yellow400 : p.theme.textColor};
  }
`;

export default BookmarkStar;
