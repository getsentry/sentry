import {EmptyState} from '@sentry/scraps/emptyState';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {t} from 'sentry/locale';
import {unreachable} from 'sentry/utils/unreachable';

import {InboxIssuePreview} from './inboxIssuePreview';
import {InboxNotebookPreview} from './inboxNotebookPreview';
import type {InboxSubject} from './types';

interface InboxItemPreviewProps {
  subject: InboxSubject | null;
}

function InboxItemPreviewContent({subject}: InboxItemPreviewProps) {
  if (!subject) {
    return (
      <EmptyState
        padding="2xl"
        title={t('No item selected')}
        description={t('Select an item from your inbox to preview it here.')}
      />
    );
  }

  switch (subject.subjectType) {
    case 'issue':
      return <InboxIssuePreview key={subject.subjectId} groupId={subject.subjectId} />;
    case 'notebook':
      return (
        <InboxNotebookPreview
          key={subject.subjectId}
          investigationId={subject.subjectId}
        />
      );
    default:
      unreachable(subject.subjectType);
      return null;
  }
}

export function InboxItemPreview({subject}: InboxItemPreviewProps) {
  return (
    <AnalyticsArea name="inbox.preview" overrideParent>
      <InboxItemPreviewContent subject={subject} />
    </AnalyticsArea>
  );
}
