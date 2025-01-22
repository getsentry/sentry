import {t} from 'sentry/locale';

import type {Rule} from '../types';

import ModalManager from './modalManager';

type ModalManagerProps = ModalManager['props'];
type Props = Omit<ModalManagerProps, 'title' | 'initialValues' | 'onGetNewRules'> & {
  rule: Rule;
};

function Edit({savedRules, rule, ...props}: Props) {
  const handleGetNewRules = (
    values: Parameters<ModalManagerProps['onGetNewRules']>[0]
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
    <ModalManager
      {...props}
      savedRules={savedRules}
      title={t('Edit an advanced data scrubbing rule')}
      initialState={rule}
      onGetNewRules={handleGetNewRules}
    />
  );
}

export default Edit;
