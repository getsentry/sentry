import {t} from 'app/locale';

import ModalManager from './modalManager';

class Add extends ModalManager {
  getTitle() {
    return t('New Relay Key');
  }

  getData() {
    const {savedRelays} = this.props;
    const trustedRelays = [...savedRelays, this.state.values];

    return {trustedRelays};
  }
}

export default Add;
