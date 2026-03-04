import {t} from 'sentry/locale';
import type {
  AttributeResults,
  Rule,
} from 'sentry/views/settings/components/dataScrubbing/types';

import {DataScrubFormModal, type DataScrubFormModalProps} from './dataScrubFormModal';

type Props = Omit<
  DataScrubFormModalProps,
  'title' | 'initialValues' | 'onGetNewRules'
> & {
  attributeResults: AttributeResults;
  rule: Rule;
  savedRules: Rule[];
};

function Edit({savedRules, rule, ...props}: Props) {
  const handleGetNewRules = (
    values: Parameters<DataScrubFormModalProps['onGetNewRules']>[0]
  ) => {
    const updatedRule = {...values, id: rule.id};

    const newRules = savedRules.map(savedRule => {
      if (savedRule.id === updatedRule.id) {
        return updatedRule;
      }
      return savedRule;
    }) as Rule[];

    return newRules;
  };

  return (
    <DataScrubFormModal
      {...props}
      title={t('Edit an advanced data scrubbing rule')}
      initialState={rule}
      onGetNewRules={handleGetNewRules}
    />
  );
}

export default Edit;
