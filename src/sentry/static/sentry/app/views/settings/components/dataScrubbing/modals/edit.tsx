import omit from 'lodash/omit';

import {t} from 'app/locale';

import ModalManager from './modalManager';
import {ProjectId, Rule} from '../types';

type Props<T extends ProjectId> = ModalManager<T>['props'] & {
  rule: Rule;
};

type State = ModalManager['state'];

class Edit<T extends ProjectId> extends ModalManager<T, Props<T>, State> {
  getDefaultState() {
    const {rule} = this.props;
    const values: ModalManager['state']['values'] = {
      ...super.getDefaultState().values,
      ...omit(rule, 'id'),
    };
    return {
      ...super.getDefaultState(),
      values,
    };
  }

  getTitle() {
    return t('Edit an advanced data scrubbing rule');
  }

  getNewRules() {
    const {savedRules, rule} = this.props;
    const updatedRule = {...this.state.values, id: rule.id};

    const newRules = savedRules.map(savedRule => {
      if (savedRule.id === updatedRule.id) {
        return updatedRule;
      }
      return savedRule;
    }) as Array<Rule>;

    return newRules;
  }
}

export default Edit;
