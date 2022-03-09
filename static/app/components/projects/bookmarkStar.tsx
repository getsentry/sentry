import * as React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {update} from 'sentry/actionCreators/projects';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';

type Props = {
  organization: Organization;
  project: Project;
  className?: string;
  /* used to override when under local state */
  isBookmarked?: boolean;
  onToggle?: (isBookmarked: boolean) => void;
};

const BookmarkStar = ({
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
    }).catch(() => {
      addErrorMessage(t('Unable to toggle bookmark for %s', project.slug));
    });

    // needed to dismiss tooltip
    (document.activeElement as HTMLElement).blur();

    // prevent dropdowns from closing
    event.stopPropagation();

    if (onToggle) {
      onToggle(!isBookmarked);
    }
  };

  return (
    <Star
      isBookmarked={isBookmarked}
      isSolid={isBookmarked}
      onClick={toggleProjectBookmark}
      className={className}
    />
  );
};

const Star = styled(IconStar, {shouldForwardProp: p => p !== 'isBookmarked'})<{
  isBookmarked: boolean;
}>`
  color: ${p => (p.isBookmarked ? p.theme.yellow300 : p.theme.gray200)};
  cursor: pointer;
`;

export default BookmarkStar;
