import {EmptyState} from '@sentry/scraps/emptyState';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {t} from 'sentry/locale';
import {unreachable} from 'sentry/utils/unreachable';
import {InboxIssuePreview} from 'sentry/views/inbox/inboxIssuePreview';
import {InboxNotebookPreview} from 'sentry/views/inbox/inboxNotebookPreview';
import type {InboxItem} from 'sentry/views/inbox/types';

interface InboxItemPreviewProps {
  item: InboxItem | null;
}

function InboxItemPreviewContent({item}: InboxItemPreviewProps) {
  if (!item) {
    return (
      <EmptyState
        padding="2xl"
        title={t('No item selected')}
        description={t('Select an item from your inbox to preview it here.')}
      />
    );
  }

  switch (item.subjectType) {
    case 'issue':
      return <InboxIssuePreview key={item.subjectId} groupId={item.subjectId} />;
    case 'notebook':
      return (
        <InboxNotebookPreview key={item.subjectId} investigationId={item.subjectId} />
      );
    default:
      unreachable(item.subjectType);
      return null;
  }
}

export function InboxItemPreview({item}: InboxItemPreviewProps) {
  return (
    <AnalyticsArea name="inbox.preview" overrideParent>
      <InboxItemPreviewContent item={item} />
    </AnalyticsArea>
  );
}
