from __future__ import absolute_import

from sentry.models import Relay


def resolve(signature):
    # TODO(hazat): actually do right signature splitting
    if '#' in signature:
        relay_id, public_key = signature.split('#', 1)
        relay = Relay.objects.get(relay_id=relay_id)
    else:
        # TODO(hazat): Remove this, this allows everything and returns the first relay
        relay = Relay.objects.get()
    return relay
