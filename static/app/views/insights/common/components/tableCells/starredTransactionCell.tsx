import {useState} from 'react';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';
import {useStarredTransactions} from 'sentry/views/insights/common/utils/useStarredTransactions';

interface Props {
  containerProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
  isStarred?: boolean;
  projectSlug?: string;
  transactionName?: string;
}

export function StarredTransactionCell({
  transactionName,
  isStarred: initialIsStarred,
  projectSlug,
}: Props) {
  const {projects} = useProjects();
  const {starTransaction, unstarTransaction} = useStarredTransactions();
  const [queryLoading, setQueryLoading] = useState(false);
  const [isStarred, setIsStarred] = useState(initialIsStarred);

  const project = projects.find(p => p.slug === projectSlug);
  const disabled = !project || !transactionName || queryLoading;

  const toggleStarredTransaction = async () => {
    if (project && transactionName && !queryLoading) {
      setQueryLoading(true);
      setIsStarred(!isStarred);
      addLoadingMessage();

      if (isStarred) {
        await unstarTransaction(transactionName, project.id);
      } else {
        await starTransaction(transactionName, project.id);
      }

      addSuccessMessage(t('Transaction starred'));
      setQueryLoading(false);
    }
  };

  return (
    <Button
      onClick={() => toggleStarredTransaction()}
      disabled={disabled}
      borderless
      size="zero"
      icon={
        <IconStar
          color={isStarred ? 'yellow300' : 'gray200'}
          isSolid={isStarred}
          data-test-id="starred-transaction-column"
        />
      }
      aria-label={t('Toggle star for transaction')}
    />
  );
}
