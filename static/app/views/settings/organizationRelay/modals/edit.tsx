import {t} from 'sentry/locale';
import type {Relay} from 'sentry/types/relay';

import {ModalManager} from './modalManager';

type Props = {
  relay: Relay;
} & ModalManager['props'];

export class Edit extends ModalManager<Props> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      values: {
        name: this.props.relay.name,
        publicKey: this.props.relay.publicKey,
        description: this.props.relay.description || '',
      },
      disables: {publicKey: true},
    };
  }

  getTitle() {
    return t('Edit Key');
  }

  getData() {
    const {savedRelays} = this.props;
    const updatedRelay = this.state.values;

    const trustedRelays = savedRelays.map(relay => {
      if (relay.publicKey === updatedRelay.publicKey) {
        return updatedRelay;
      }
      return relay;
    });

    return {trustedRelays};
  }
}
