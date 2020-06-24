import {t} from 'app/locale';

import ModalManager from './modalManager';
import {ProjectId, Rule} from '../types';

class Add<T extends ProjectId> extends ModalManager<T> {
  getTitle() {
    return t('Add an advanced data scrubbing rule');
  }

  getNewRules() {
    const {savedRules} = this.props;
    return [...savedRules, {...this.state.values, id: savedRules.length}] as Array<Rule>;
  }
}

export default Add;
