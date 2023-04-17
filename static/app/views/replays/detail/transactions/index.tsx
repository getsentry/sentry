import Placeholder from 'sentry/components/placeholder';
import TransactionsTable from 'sentry/views/replays/detail/transactions/transactionsTable';
import {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayRecord: undefined | ReplayRecord;
};

function Transactions({replayRecord}: Props) {
  if (!replayRecord) {
    return <Placeholder height="100%" />;
  }

  return <TransactionsTable replayRecord={replayRecord} />;
}
export default Transactions;
