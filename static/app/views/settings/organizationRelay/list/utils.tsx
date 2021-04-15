import {Relay, RelayActivity, RelaysByPublickey} from 'app/types';

/**
 * Convert list of individual relay objects into a per-file summary grouped by publicKey
 */
export function getRelaysByPublicKey(
  relays: Array<Relay>,
  relayActivities: Array<RelayActivity>
) {
  return relays.reduce<RelaysByPublickey>((relaysByPublicKey, relay) => {
    const {name, description, created, publicKey} = relay;

    if (!relaysByPublicKey.hasOwnProperty(publicKey)) {
      relaysByPublicKey[publicKey] = {name, description, created, activities: []};
    }

    if (!relaysByPublicKey[publicKey].activities.length) {
      relaysByPublicKey[publicKey].activities = relayActivities.filter(
        activity => activity.publicKey === publicKey
      );
    }

    return relaysByPublicKey;
  }, {});
}

/**
 * Returns a short publicKey with only 20 characters
 */
export function getShortPublicKey(publicKey: Relay['publicKey']) {
  return publicKey.substring(0, 20);
}
