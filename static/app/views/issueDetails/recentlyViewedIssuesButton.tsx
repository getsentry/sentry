import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconStar} from 'sentry/icons';
import {useOrganization} from 'sentry/stores/useOrganization';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {RecentlyViewedIssue} from './groupDetails';

function RecentlyViewedIssuesButton({currentIssueId = ''}: {currentIssueId?: string}) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const [starredIssues, setStarredIssues] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('starredIssues');
    if (stored) {
      setStarredIssues(JSON.parse(stored));
    }
  }, []);

  const recentlyViewedIssues = localStorage.getItem('recentlyViewedIssues');
  const parsedRecentlyViewedIssues: RecentlyViewedIssue[] = recentlyViewedIssues
    ? JSON.parse(recentlyViewedIssues)
    : [];
  const items =
    recentlyViewedIssues || starredIssues
      ? parsedRecentlyViewedIssues
          .filter(
            (issue: RecentlyViewedIssue) =>
              organization.slug === issue.orgSlug && issue.id !== currentIssueId
          )
          .map((issue: RecentlyViewedIssue) => ({
            key: issue.id,
            label: `${issue.title} (${issue.id})`,
            onAction: () => {
              navigate(issue.url);
            },
            trailingItems: (
              <IconButton
                data-star-button
                onClick={e => {
                  const isStarred = starredIssues.includes(issue.id);
                  if (isStarred) {
                    // Remove this issue from starred
                    const updatedStarredIssues = starredIssues.filter(
                      id => id !== issue.id
                    );
                    localStorage.setItem(
                      'starredIssues',
                      JSON.stringify(updatedStarredIssues)
                    );
                    setStarredIssues(updatedStarredIssues);
                  } else {
                    // Add this issue to starred
                    const updatedStarredIssues = [...starredIssues, issue.id];
                    localStorage.setItem(
                      'starredIssues',
                      JSON.stringify(updatedStarredIssues)
                    );
                    setStarredIssues(updatedStarredIssues);
                  }
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <IconStar size="xs" isSolid={starredIssues.includes(issue.id)} />
              </IconButton>
            ),
          }))
      : [];

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      items={items}
      trigger={triggerProps => (
        <StyledDropdownButton size="xs" {...triggerProps}>
          Recently Viewed Issues
        </StyledDropdownButton>
      )}
      size="xs"
      position="bottom-end"
    />
  );
}

const IconButton = styled('button')`
  background: none;
  border: none;
  padding: ${p => p.theme.space.xs};
  cursor: pointer;
  color: ${p => p.theme.subText};
  border-radius: ${p => p.theme.borderRadius};

  &:hover {
    background: ${p => p.theme.hover};
    color: ${p => p.theme.textColor};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${p => p.theme.focusBorder};
  }
`;

const StyledDropdownButton = styled(DropdownButton)`
  color: ${p => p.theme.button.primary.background};
  :hover {
    color: ${p => p.theme.button.primary.background};
  }
`;

export default RecentlyViewedIssuesButton;
