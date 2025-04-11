import {useState} from 'react';

import {Button} from 'sentry/components/core/button';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {FlexContainer} from 'sentry/utils/discover/styles';
import useProjects from 'sentry/utils/useProjects';
import {
  type StarTransactionParams,
  useStarredTransactions,
} from 'sentry/views/insights/common/utils/useStarredTransactions';

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
  const {
    starTransaction,
    unstarTransaction,
    starTransactionResult,
    unstarTransactionResult,
  } = useStarredTransactions();
  const [isStarred, setIsStarred] = useState(initialIsStarred);

  const queryLoading =
    starTransactionResult.isPending || unstarTransactionResult.isPending;

  const project = projects.find(p => p.slug === projectSlug);
  const disabled = !project || !transactionName || queryLoading;

  const toggleStarredTransaction = () => {
    if (project && transactionName && !queryLoading) {
      setIsStarred(!isStarred);
      const params: StarTransactionParams = {
        projectId: project.id,
        segmentName: transactionName,
      };

      if (isStarred) {
        unstarTransaction(params);
      } else {
        starTransaction(params);
      }
    }
  };

  return (
    <FlexContainer>
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
    </FlexContainer>
  );
}
