from __future__ import absolute_import

from sentry.eventtypes import transaction
from sentry.models.relay import Relay


def ensure_relay_is_registered():
    """
    Ensure that the test Relay instance is registered

    Note: This is an ugly hack, we need it because we are persisting a Relay instance during the whole
    test session and the database is cleaned up after each test.
    Relay will do a security handshake when it is started and this will result in a Relay object
    being added in the database. After the test is finished the entry will be cleaned up and next
    time Relay will be used in another test it will not be recognized as an internal relay.

    TODO: A fix for this would be to restart Relay for every test I (RaduW) need to investigate the
    performance hit for starting relay for every test that uses it.
    """
    try:
        with transaction.atomic():
            # just check for the Relay object and insert it if it does not exist
            Relay.objects.create(
                relay_id="88888888-4444-4444-8444-cccccccccccc",
                public_key="SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8",
                is_internal=True,
            )
    except:  # NOQA
        # relay already registered  probably the first test (registration happened at Relay handshake time)
        pass  # NOQA


def adjust_settings_for_relay_tests(settings):
    """
    Adjusts the application settings to accept calls from a Relay instance running inside a
    docker container.

    :param settings: the app settings
    """
    settings.ALLOWED_HOSTS = ["localhost", "testserver", "host.docker.internal"]
    settings.KAFKA_CLUSTERS = {
        "default": {
            "bootstrap.servers": "127.0.0.1:9092",
            "compression.type": "lz4",
            "message.max.bytes": 50000000,  # 50MB, default is 1MB
        }
    }
    settings.SENTRY_RELAY_WHITELIST_PK = ["SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8"]
