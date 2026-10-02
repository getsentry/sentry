import {Button} from '@sentry/scraps/button';

import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {EventView} from 'sentry/utils/discover/eventView';

import type {TransactionThresholdMetric} from './transactionThresholdModal';
import {useTransactionThreshold} from './useTransactionThreshold';

type Props = {
  eventView: EventView;
  organization: Organization;
  transactionName: string;
  onChangeThreshold?: (threshold: number, metric: TransactionThresholdMetric) => void;
};

export function TransactionThresholdButton({
  eventView,
  onChangeThreshold,
  organization,
  transactionName,
}: Props) {
  const {isLoading, openThresholdModal} = useTransactionThreshold({
    eventView,
    organization,
    transactionName,
    onChangeThreshold,
  });

  return (
    <Button
      size="sm"
      onClick={openThresholdModal}
      icon={<IconSettings />}
      disabled={isLoading}
      aria-label={t('Settings')}
      data-test-id="set-transaction-threshold"
    />
  );
}
