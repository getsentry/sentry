import {EmptyState} from '@sentry/scraps/emptyState';
import {Container} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {unreachable} from 'sentry/utils/unreachable';
import type {InboxItem} from 'sentry/views/inbox/types';

interface InboxItemPreviewProps {
  item: InboxItem | null;
}

export function InboxItemPreview({item}: InboxItemPreviewProps) {
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
      return <InboxIssuePreview item={item} />;
    case 'notebook':
      return <InboxNotebookPreview item={item} />;
    default:
      unreachable(item.subjectType);
      return null;
  }
}

interface InboxSubjectPreviewProps {
  item: InboxItem;
}

// TODO: Render the issue details
function InboxIssuePreview({item}: InboxSubjectPreviewProps) {
  return (
    <Container padding="xl">
      <Heading as="h2">{item.subject?.title ?? t('Unavailable')}</Heading>
    </Container>
  );
}

// TODO: Render the investigation notebook
function InboxNotebookPreview({item}: InboxSubjectPreviewProps) {
  return (
    <Container padding="xl">
      <Heading as="h2">{item.subject?.title ?? t('Unavailable')}</Heading>
    </Container>
  );
}
