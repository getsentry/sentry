from uuid import uuid4

import pytest


@pytest.fixture
def key_pair():
    from sentry_relay.auth import generate_key_pair

    return generate_key_pair()


@pytest.fixture
def public_key(key_pair):
    return key_pair[1]


@pytest.fixture
def private_key(key_pair):
    return key_pair[0]


@pytest.fixture
def relay_id():
    return str(uuid4())


@pytest.fixture
def relay(relay_id, public_key):
    from sentry.models.relay import Relay

    return Relay.objects.create(relay_id=relay_id, public_key=str(public_key), is_internal=True)
