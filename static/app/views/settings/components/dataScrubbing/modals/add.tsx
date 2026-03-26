import {t} from 'sentry/locale';
import type {Rule} from 'sentry/views/settings/components/dataScrubbing/types';

import {DataScrubFormModal, type DataScrubFormModalProps} from './dataScrubFormModal';

type Props = Omit<DataScrubFormModalProps, 'title' | 'onGetNewRules'> & {
  savedRules: Rule[];
};

export function Add({savedRules, ...props}: Props) {
  const handleGetNewRules = (
    values: Parameters<DataScrubFormModalProps['onGetNewRules']>[0]
  ) => {
    return [...savedRules, {...values, id: savedRules.length}] as Rule[];
  };

  return (
    <DataScrubFormModal
      {...props}
      title={t('Add an advanced data scrubbing rule')}
      onGetNewRules={handleGetNewRules}
    />
  );
}
// trivial change for CI testing
