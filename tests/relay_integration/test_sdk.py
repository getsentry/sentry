import uuid
from unittest import mock

import pytest
from django.test.utils import override_settings
from sentry_sdk import Hub, push_scope

from sentry import eventstore
from sentry.eventstore.models import Event
from sentry.testutils import assert_mock_called_once_with_partial
from sentry.utils.pytest.relay import adjust_settings_for_relay_tests
from sentry.utils.sdk import bind_organization_context, configure_sdk


@pytest.fixture
def post_event_with_sdk(settings, relay_server, wait_for_ingest_consumer):
    adjust_settings_for_relay_tests(settings)
    settings.SENTRY_ENDPOINT = relay_server["url"]
    settings.SENTRY_PROJECT = 1

    configure_sdk()
    hub = Hub.current  # XXX: Hub.current gets reset, this is a workaround

    def bind_client(self, new, *, _orig=Hub.bind_client):
        if new is None:
            import sys
            import traceback

            print("!!! Hub client was reset to None !!!", file=sys.stderr)  # noqa: S002
            traceback.print_stack()
            print("!!!", file=sys.stderr)  # noqa: S002

        return _orig(self, new)

    # XXX: trying to figure out why it gets reset
    with mock.patch.object(Hub, "bind_client", bind_client):
        wait_for_ingest_consumer = wait_for_ingest_consumer(settings)

        def inner(*args, **kwargs):
            assert Hub.current.client is not None

            event_id = hub.capture_event(*args, **kwargs)
            hub.client.flush()

            with push_scope():
                return wait_for_ingest_consumer(
                    lambda: eventstore.get_event_by_id(settings.SENTRY_PROJECT, event_id)
                )

        yield inner


@override_settings(SENTRY_PROJECT=1)
@pytest.mark.django_db
def test_simple(settings, post_event_with_sdk):
    event = post_event_with_sdk({"message": "internal client test"})

    assert event
    assert event.data["project"] == settings.SENTRY_PROJECT
    assert event.data["logentry"]["formatted"] == "internal client test"


@override_settings(SENTRY_PROJECT=1)
@pytest.mark.django_db
def test_recursion_breaker(settings, post_event_with_sdk):
    # If this test terminates at all then we avoided recursion.
    settings.SENTRY_INGEST_CONSUMER_APM_SAMPLING = 1.0
    settings.SENTRY_PROJECT = 1

    event_id = uuid.uuid4().hex
    with mock.patch(
        "sentry.event_manager.EventManager.save", spec=Event, side_effect=ValueError("oh no!")
    ) as save:
        with pytest.raises(ValueError):
            post_event_with_sdk({"message": "internal client test", "event_id": event_id})

    assert_mock_called_once_with_partial(save, settings.SENTRY_PROJECT, cache_key=f"e:{event_id}:1")


@pytest.mark.django_db
@override_settings(SENTRY_PROJECT=1)
def test_encoding(settings, post_event_with_sdk):
    class NotJSONSerializable:
        pass

    with push_scope() as scope:
        scope.set_extra("request", NotJSONSerializable())
        event = post_event_with_sdk({"message": "check the req"})

    assert event.data["project"] == settings.SENTRY_PROJECT
    assert event.data["logentry"]["formatted"] == "check the req"
    assert "NotJSONSerializable" in event.data["extra"]["request"]


@override_settings(SENTRY_PROJECT=1)
@pytest.mark.django_db
def test_bind_organization_context(default_organization):

    configure_sdk()

    bind_organization_context(default_organization)

    assert Hub.current.scope._tags["organization"] == default_organization.id
    assert Hub.current.scope._tags["organization.slug"] == default_organization.slug
    assert Hub.current.scope._contexts["organization"] == {
        "id": default_organization.id,
        "slug": default_organization.slug,
    }


@override_settings(SENTRY_PROJECT=1)
@pytest.mark.django_db
def test_bind_organization_context_with_callback(settings, default_organization):
    configure_sdk()

    def add_context(scope, organization, **kwargs):
        scope.set_tag("organization.test", "1")

    settings.SENTRY_ORGANIZATION_CONTEXT_HELPER = add_context
    bind_organization_context(default_organization)

    assert Hub.current.scope._tags["organization.test"] == "1"


@override_settings(SENTRY_PROJECT=1)
@pytest.mark.django_db
def test_bind_organization_context_with_callback_error(settings, default_organization):
    configure_sdk()

    def add_context(scope, organization, **kwargs):
        1 / 0

    settings.SENTRY_ORGANIZATION_CONTEXT_HELPER = add_context
    bind_organization_context(default_organization)

    assert Hub.current.scope._tags["organization"] == default_organization.id
