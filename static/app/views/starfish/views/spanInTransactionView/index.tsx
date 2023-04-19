import {RouteComponentProps} from 'react-router';

import * as Layout from 'sentry/components/layouts/thirds';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';

type Props = RouteComponentProps<{slug?: string}, {}>;

export default function SpanInTransactionView({params}: Props) {
  const slug = parseSlug(params.slug);

  if (!slug) {
    return <div>ERROR</div>;
  }

  const {spanDescription, transactionName} = slug;

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{transactionName}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <h2>Span Description</h2>
            {spanDescription}
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

type SpanInTransactionSlug = {
  spanDescription: string;
  transactionName: string;
};

function parseSlug(slug?: string): SpanInTransactionSlug | undefined {
  if (!slug) {
    return undefined;
  }

  const delimiterPosition = slug.lastIndexOf(':');
  if (delimiterPosition < 0) {
    return undefined;
  }

  const spanDescription = slug.slice(0, delimiterPosition);
  const transactionName = slug.slice(delimiterPosition + 1);

  return {spanDescription, transactionName};
}
