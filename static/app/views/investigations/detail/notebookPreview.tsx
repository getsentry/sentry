import {Container} from '@sentry/scraps/layout';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {InvestigationDetail} from 'sentry/views/investigations/types';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

import {InvestigationAccess} from './investigationAccess';
import {InvestigationPageContent} from './investigationPageContent';
import {useInvestigationDetail} from './useInvestigationDetail';
import {useInvestigationTitle} from './useInvestigationTitle';

interface NotebookPreviewProps {
  investigationId: string;
  workflowRunning?: boolean;
}

export function NotebookPreview(props: NotebookPreviewProps) {
  return (
    <InvestigationAccess>
      <NotebookPreviewContent {...props} />
    </InvestigationAccess>
  );
}

function NotebookInner({investigation}: {investigation: InvestigationDetail}) {
  const title = useInvestigationTitle(investigation);

  return (
    <Container containerType="inline-size">
      <InvestigationPageContent investigation={investigation} title={title} />
    </Container>
  );
}

const Notebook = registerLLMContext('investigation', NotebookInner);

function NotebookPreviewContent({
  investigationId,
  workflowRunning,
}: NotebookPreviewProps) {
  const {
    data: investigation,
    isError,
    refetch,
  } = useInvestigationDetail(investigationId, workflowRunning);

  if (!investigation) {
    return isError ? <LoadingError onRetry={refetch} /> : <LoadingIndicator />;
  }

  return <Notebook investigation={investigation} />;
}
