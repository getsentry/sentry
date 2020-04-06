from __future__ import absolute_import, print_function

import pytest

from sentry_sdk import Hub, last_event_id

from django.conf import settings
from sentry.utils.sdk import configure_sdk, bind_organization_context
from sentry.utils.compat import mock
from sentry.app import raven

from sentry import eventstore
from sentry.testutils import assert_mock_called_once_with_partial
from sentry.testutils.relay import adjust_settings_for_relay_tests


@pytest.fixture
def post_event_with_sdk(settings, relay_server, wait_for_ingest_consumer):
    adjust_settings_for_relay_tests(settings)
    settings.SENTRY_ENDPOINT = relay_server["url"]

    configure_sdk()

    wait_for_ingest_consumer = wait_for_ingest_consumer(settings)

    def inner(*args, **kwargs):
        event_id = raven.captureMessage(*args, **kwargs)
        Hub.current.client.flush()

        return wait_for_ingest_consumer(
            lambda: eventstore.get_event_by_id(settings.SENTRY_PROJECT, event_id)
        )

    return inner


@pytest.mark.django_db
def test_simple(post_event_with_sdk):
    event = post_event_with_sdk("internal client test")

    assert event
    assert event.data["project"] == settings.SENTRY_PROJECT
    assert event.data["event_id"] == last_event_id()
    assert event.data["logentry"]["formatted"] == "internal client test"


@pytest.mark.django_db
def test_recursion_breaker(post_event_with_sdk):
    # If this test terminates at all then we avoided recursion.
    with mock.patch(
        "sentry.event_manager.EventManager.save", side_effect=ValueError("oh no!")
    ) as save:
        with pytest.raises(ValueError):
            post_event_with_sdk("internal client test")

    assert_mock_called_once_with_partial(
        save, settings.SENTRY_PROJECT, cache_key=u"e:{}:1".format(last_event_id())
    )


@pytest.mark.django_db
def test_encoding(post_event_with_sdk):
    class NotJSONSerializable:
        pass

    event = post_event_with_sdk("check the req", extra={"request": NotJSONSerializable()})

    assert event.data["project"] == settings.SENTRY_PROJECT
    assert event.data["logentry"]["formatted"] == "check the req"
    assert "NotJSONSerializable" in event.data["extra"]["request"]


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


@pytest.mark.django_db
def test_bind_organization_context_with_callback(settings, default_organization):
    configure_sdk()

    def add_context(scope, organization, **kwargs):
        scope.set_tag("organization.test", "1")

    settings.SENTRY_ORGANIZATION_CONTEXT_HELPER = add_context
    bind_organization_context(default_organization)

    assert Hub.current.scope._tags["organization.test"] == "1"


@pytest.mark.django_db
def test_bind_organization_context_with_callback_error(settings, default_organization):
    configure_sdk()

    def add_context(scope, organization, **kwargs):
        1 / 0

    settings.SENTRY_ORGANIZATION_CONTEXT_HELPER = add_context
    bind_organization_context(default_organization)

    assert Hub.current.scope._tags["organization"] == default_organization.id
