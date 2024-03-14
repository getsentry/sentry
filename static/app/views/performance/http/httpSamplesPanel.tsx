import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';

type Query = {
  domain?: string;
  transaction?: string;
  transactionMethod?: string;
};

export function HTTPSamplesPanel() {
  const location = useLocation<Query>();
  const router = useRouter();

  const {domain, transaction, transactionMethod} = location.query;

  // `detailKey` controls whether the panel is open. If all required properties are available, concat them to make a key, otherwise set to `undefined` and hide the panel
  const detailKey =
    transaction && domain
      ? [domain, transactionMethod, transaction].filter(Boolean).join(':')
      : undefined;

  const handleClose = () => {
    router.replace({
      pathname: router.location.pathname,
      query: {
        ...router.location.query,
        transaction: undefined,
        transactionMethod: undefined,
      },
    });
  };

  return (
    <PageAlertProvider>
      <DetailPanel detailKey={detailKey} onClose={handleClose}>
        <h1>
          {transactionMethod} {transaction}
        </h1>
      </DetailPanel>
    </PageAlertProvider>
  );
}
