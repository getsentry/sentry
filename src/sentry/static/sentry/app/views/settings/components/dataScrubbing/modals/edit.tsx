import {t} from 'app/locale';

import ModalManager from './modalManager';
import {Rule, ProjectId} from '../types';

type ModalManagerProps<T extends ProjectId> = ModalManager<T>['props'];
type Props<T extends ProjectId> = Omit<
  ModalManagerProps<T>,
  'title' | 'initialValues' | 'onGetNewRules'
> & {
  rule: Rule;
};

const Edit = <T extends ProjectId>({savedRules, rule, ...props}: Props<T>) => {
  const handleGetNewRules = (
    values: Parameters<ModalManagerProps<T>['onGetNewRules']>[0]
  ) => {
    const updatedRule = {...values, id: rule.id};

    const newRules = savedRules.map(savedRule => {
      if (savedRule.id === updatedRule.id) {
        return updatedRule;
      }
      return savedRule;
    }) as Array<Rule>;

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
};

export default Edit;
