import {Container} from '@sentry/scraps/layout';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {InvestigationAccess} from 'sentry/views/investigations/detail/investigationAccess';
import {InvestigationPageContent} from 'sentry/views/investigations/detail/investigationPageContent';
import {useInvestigationDetail} from 'sentry/views/investigations/detail/useInvestigationDetail';
import {useInvestigationTitle} from 'sentry/views/investigations/detail/useInvestigationTitle';
import type {InvestigationDetail} from 'sentry/views/investigations/types';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

interface InboxNotebookPreviewProps {
  investigationId: string;
}

export function InboxNotebookPreview({investigationId}: InboxNotebookPreviewProps) {
  return (
    <InvestigationAccess>
      <InboxNotebookPreviewContent investigationId={investigationId} />
    </InvestigationAccess>
  );
}

function InboxNotebookInner({investigation}: {investigation: InvestigationDetail}) {
  const title = useInvestigationTitle(investigation);

  return (
    <Container containerType="inline-size">
      <InvestigationPageContent investigation={investigation} title={title} />
    </Container>
  );
}

const InboxNotebook = registerLLMContext('investigation', InboxNotebookInner);

function InboxNotebookPreviewContent({investigationId}: InboxNotebookPreviewProps) {
  const {data: investigation, isError, refetch} = useInvestigationDetail(investigationId);

  if (!investigation) {
    return isError ? <LoadingError onRetry={refetch} /> : <LoadingIndicator />;
  }

  return <InboxNotebook investigation={investigation} />;
}
