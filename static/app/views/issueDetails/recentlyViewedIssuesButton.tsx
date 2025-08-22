import styled from '@emotion/styled';

import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {RecentlyViewedIssue} from './groupDetails';

function RecentlyViewedIssuesButton({currentIssueId = ''}: {currentIssueId?: string}) {
  const navigate = useNavigate();

  const recentlyViewedIssues = localStorage.getItem('recentlyViewedIssues');
  const parsedRecentlyViewedIssues: RecentlyViewedIssue[] = recentlyViewedIssues
    ? JSON.parse(recentlyViewedIssues)
    : [];
  const items = recentlyViewedIssues
    ? parsedRecentlyViewedIssues
        .filter((issue: RecentlyViewedIssue) => issue.id !== currentIssueId)
        .map((issue: RecentlyViewedIssue) => ({
          key: issue.id,
          label: `${issue.title} (${issue.id})`,
          onAction: () => {
            navigate(issue.url);
          },
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

const StyledDropdownButton = styled(DropdownButton)`
  color: ${p => p.theme.button.primary.background};
  :hover {
    color: ${p => p.theme.button.primary.background};
  }
`;

export default RecentlyViewedIssuesButton;
