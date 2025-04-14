import {Button} from 'sentry/components/core/button';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {FlexContainer} from 'sentry/utils/discover/styles';
import useProjects from 'sentry/utils/useProjects';
import {useStarredTransaction} from 'sentry/views/insights/common/utils/useStarredTransactions';

interface Props {
  initialIsStarred: boolean;
  projectSlug: string;
  transactionName: string;
}

export function StarredTransactionCell({
  transactionName,
  initialIsStarred,
  projectSlug,
}: Props) {
  const {projects} = useProjects();

  const {toggleStarredTransaction, isPending, isStarred} = useStarredTransaction({
    initialIsStarred,
    projectSlug,
    transactionName,
  });

  const project = projects.find(p => p.slug === projectSlug);
  const disabled = !project || !transactionName || isPending;

  return (
    <FlexContainer>
      <Button
        onClick={toggleStarredTransaction}
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
