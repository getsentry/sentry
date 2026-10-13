import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Relay} from 'sentry/types/relay';

import {ModalManager} from './modalManager';

type Props = ModalRenderProps & {
  onSubmitSuccess: (organization: Organization) => void;
  orgSlug: Organization['slug'];
  relay: Relay;
  savedRelays: Relay[];
};

export function Edit({relay, savedRelays, ...modalManagerProps}: Props) {
  return (
    <ModalManager
      {...modalManagerProps}
      savedRelays={savedRelays}
      title={t('Edit Key')}
      initialValues={{
        name: relay.name,
        publicKey: relay.publicKey,
        description: relay.description ?? '',
      }}
      initialDisables={{publicKey: true}}
      getData={(values, relays) => ({
        trustedRelays: relays.map(r =>
          r.publicKey === values.publicKey ? {...r, ...values} : r
        ),
      })}
    />
  );
}
