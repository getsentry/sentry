from __future__ import absolute_import, print_function

import os

from sentry import eventstore

from django.core.urlresolvers import reverse
from exam import fixture
from sentry.testutils import TransactionTestCase, RelayStoreHelper
from sentry.testutils.helpers.datetime import iso_format, before_now


def get_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), "fixtures", name)


def load_fixture(name):
    with open(get_fixture_path(name)) as fp:
        return fp.read()


class SentryRemoteTest(RelayStoreHelper, TransactionTestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-store")

    def get_event(self, event_id):
        instance = eventstore.get_event_by_id(self.project.id, event_id)
        return instance

    # used to be test_ungzipped_data
    def test_simple_data(self):
        event_data = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}
        event = self.post_and_retrieve_event(event_data)

        assert event.message == "hello"
