import {useCallback} from 'react';

import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';

interface UseCopyShortcutsProps {
  group: Group;
  event?: Event;
}

/**
 * Hook for general copy shortcuts in issue details
 * Provides shortcuts for copying issue URL, short ID, and event ID
 */
export function useCopyShortcuts({group, event}: UseCopyShortcutsProps) {
  const organization = useOrganization();

  // Copy issue URL
  const issueUrl = useCallback(() => {
    return (
      window.location.origin +
      normalizeUrl(`/organizations/${organization.slug}/issues/${group.id}/`)
    );
  }, [organization.slug, group.id]);

  const {onClick: handleCopyIssueUrl} = useCopyToClipboard({
    text: issueUrl(),
    successMessage: t('Copied Issue URL to clipboard'),
  });

  // Copy issue short ID
  const {onClick: handleCopyShortId} = useCopyToClipboard({
    text: group.shortId,
    successMessage: t('Copied Short-ID to clipboard'),
  });

  // Copy event ID
  const {onClick: handleCopyEventId} = useCopyToClipboard({
    text: event?.id || '',
    successMessage: t('Copied Event ID to clipboard'),
  });

  const shortcuts = [
    {
      id: 'copy-issue-url',
      key: ',',
      description: 'Copy issue URL to clipboard',
      handler: handleCopyIssueUrl,
    },
    {
      id: 'copy-short-id',
      key: '.',
      description: 'Copy issue short ID to clipboard',
      handler: handleCopyShortId,
    },
  ];

  // Only add event ID shortcut if we have an event
  if (event?.id) {
    shortcuts.push({
      id: 'copy-event-id',
      key: "'",
      description: 'Copy event ID to clipboard',
      handler: handleCopyEventId,
    });
  }

  useComponentShortcuts('issue-details-general', shortcuts);
}
