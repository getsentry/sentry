import {RouteComponentProps} from 'react-router';
import {useQuery} from '@tanstack/react-query';

import * as Layout from 'sentry/components/layouts/thirds';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {HOST} from 'sentry/views/starfish/modules/APIModule/APIModuleView';
import {getSpanInTransactionQuery} from 'sentry/views/starfish/modules/APIModule/queries';

import {getSpanSamplesQuery} from './queries';

type Props = RouteComponentProps<{slug: string}, {}>;

export default function SpanInTransactionView({params}: Props) {
  const slug = parseSlug(params.slug);

  const {spanDescription, transactionName} = slug || {
    spanDescription: '',
    transactionName: '',
  };

  const query = getSpanInTransactionQuery(spanDescription, transactionName);

  const {isLoading, data} = useQuery({
    queryKey: ['spanInTransaction', spanDescription, transactionName],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const spanSamplesQuery = getSpanSamplesQuery(spanDescription, transactionName);
  const {isLoading: areSpanSamplesLoading, data: spanSampleData} = useQuery({
    queryKey: ['spanSamples', spanDescription, transactionName],
    queryFn: () => fetch(`${HOST}/?query=${spanSamplesQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  if (!slug) {
    return <div>ERROR</div>;
  }

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
            Description: {spanDescription}
            {isLoading ? (
              <span>LOADING</span>
            ) : (
              <div>
                <h2>Span Stats</h2>
                <span>Count: {data?.[0]?.count}</span>
                <br />
                <span>p50: {data?.[0]?.p50}</span>
              </div>
            )}
            {areSpanSamplesLoading ? (
              <span>LOADING SAMPLE LIST</span>
            ) : (
              <div>
                <h2>SAMPLE EVENTS</h2>
                <ul>
                  {spanSampleData.map(span => (
                    <li key={span.transaction_id}>
                      <a href={`/performance/sentry:${span.transaction_id}`}>
                        {span.transaction_id}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
