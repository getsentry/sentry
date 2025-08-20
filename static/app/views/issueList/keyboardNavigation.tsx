import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {GroupStatus} from 'sentry/types/group';
import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {IssueUpdateData} from 'sentry/views/issueList/types';
import {createIssueLink} from 'sentry/views/issueList/utils';

interface IssueListKeyboardNavigationProps {
  children: React.ReactNode;
  groupIds: string[];
  onActionTaken: (itemIds: string[], data: IssueUpdateData) => void;
  query: string;
  onOpenArchiveDropdown?: () => void;
  onOpenResolveDropdown?: () => void;
}

/**
 * Wrapper component that adds keyboard navigation to the issues list
 */
export function IssueListKeyboardNavigation({
  groupIds,
  query,
  onActionTaken,
  children,
  onOpenResolveDropdown,
  onOpenArchiveDropdown,
}: IssueListKeyboardNavigationProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const organization = useOrganization();
  const location = useLocation();

  // Reset focus when groupIds change (e.g., pagination, new search)
  useEffect(() => {
    setFocusedIndex(-1);
  }, [groupIds]);

  const navigateToIssue = useCallback(
    (groupId: string) => {
      const group = GroupStore.get(groupId);
      if (!group) return;

      navigate(
        normalizeUrl(
          createIssueLink({
            data: group as any, // GroupStore.get() type mismatch with createIssueLink
            organization,
            referrer: 'keyboard-navigation',
            location,
            query,
          })
        )
      );
    },
    [navigate, organization, location, query]
  );

  const moveFocus = useCallback(
    (direction: 'up' | 'down') => {
      if (groupIds.length === 0) return;

      setFocusedIndex(currentIndex => {
        let newIndex = currentIndex;

        if (direction === 'down') {
          newIndex = currentIndex < groupIds.length - 1 ? currentIndex + 1 : currentIndex;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        }

        // If we're moving from no focus to first item
        if (currentIndex === -1 && direction === 'down') {
          newIndex = 0;
        }

        // Scroll the focused item into view
        if (newIndex >= 0 && containerRef.current) {
          const issueElements = containerRef.current.querySelectorAll(
            '[data-test-id="group"]'
          );
          const targetElement = issueElements[newIndex];
          if (targetElement) {
            targetElement.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
          }
        }

        return newIndex;
      });
    },
    [groupIds.length]
  );

  const selectFocusedIssue = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < groupIds.length) {
      const groupId = groupIds[focusedIndex];
      if (groupId) {
        SelectedGroupStore.toggleSelect(groupId);
      }
    }
  }, [focusedIndex, groupIds]);

  const openFocusedIssue = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < groupIds.length) {
      const groupId = groupIds[focusedIndex];
      if (groupId) {
        navigateToIssue(groupId);
      }
    }
  }, [focusedIndex, groupIds, navigateToIssue]);

  const resolveFocusedIssue = useCallback(() => {
    const selectedIds = SelectedGroupStore.getSelectedIds();

    // If there are selected issues, resolve all of them
    if (selectedIds.size > 0) {
      const selectedIdsArray = Array.from(selectedIds);
      onActionTaken(selectedIdsArray, {status: GroupStatus.RESOLVED, statusDetails: {}});
    } else if (focusedIndex >= 0 && focusedIndex < groupIds.length) {
      // Otherwise, resolve just the focused issue
      const groupId = groupIds[focusedIndex];
      if (groupId) {
        onActionTaken([groupId], {status: GroupStatus.RESOLVED, statusDetails: {}});
      }
    }
  }, [focusedIndex, groupIds, onActionTaken]);

  const archiveFocusedIssue = useCallback(() => {
    const selectedIds = SelectedGroupStore.getSelectedIds();

    // If there are selected issues, archive all of them
    if (selectedIds.size > 0) {
      const selectedIdsArray = Array.from(selectedIds);
      onActionTaken(selectedIdsArray, {status: GroupStatus.IGNORED, statusDetails: {}});
    } else if (focusedIndex >= 0 && focusedIndex < groupIds.length) {
      // Otherwise, archive just the focused issue
      const groupId = groupIds[focusedIndex];
      if (groupId) {
        onActionTaken([groupId], {status: GroupStatus.IGNORED, statusDetails: {}});
      }
    }
  }, [focusedIndex, groupIds, onActionTaken]);

  // Register keyboard shortcuts
  useComponentShortcuts('issues-list', [
    {
      id: 'navigate-down',
      key: 'j',
      description: 'Next issue',
      handler: () => moveFocus('down'),
    },
    {
      id: 'navigate-up',
      key: 'k',
      description: 'Previous issue',
      handler: () => moveFocus('up'),
    },
    {
      id: 'select-issue',
      key: 'x',
      description: 'Toggle issue selection',
      handler: selectFocusedIssue,
    },
    {
      id: 'open-issue',
      key: 'enter',
      description: 'Open issue details',
      handler: openFocusedIssue,
    },
    {
      id: 'resolve-issue',
      key: 'r',
      description: 'Resolve selected issues (or focused issue)',
      handler: resolveFocusedIssue,
    },
    {
      id: 'archive-issue',
      key: 'e',
      description: 'Archive selected issues (or focused issue)',
      handler: archiveFocusedIssue,
    },
    {
      id: 'open-resolve-dropdown',
      key: 'shift+r',
      description: 'Open resolve dropdown',
      handler: () => onOpenResolveDropdown?.(),
    },
    {
      id: 'open-archive-dropdown',
      key: 'shift+e',
      description: 'Open archive dropdown',
      handler: () => onOpenArchiveDropdown?.(),
    },
  ]);

  // Add visual indicator for focused issue
  useEffect(() => {
    if (containerRef.current) {
      const issueElements = containerRef.current.querySelectorAll(
        '[data-test-id="group"]'
      );

      // Remove previous focus styles
      issueElements.forEach(el => {
        el.classList.remove('keyboard-focused');
      });

      // Add focus style to current
      if (focusedIndex >= 0 && issueElements[focusedIndex]) {
        issueElements[focusedIndex].classList.add('keyboard-focused');
      }
    }
  }, [focusedIndex]);

  return <NavigationContainer ref={containerRef}>{children}</NavigationContainer>;
}

const NavigationContainer = styled('div')`
  /* Add styles for keyboard focus indicator */
  [data-test-id='group'].keyboard-focused {
    outline: 2px solid ${p => p.theme.purple300};
    outline-offset: -2px;
  }
`;
