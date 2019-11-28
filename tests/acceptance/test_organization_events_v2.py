from __future__ import absolute_import

import pytz
from mock import patch

from six.moves.urllib.parse import urlencode

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.utils.samples import load_data
from sentry.testutils.helpers.datetime import iso_format, before_now


FEATURE_NAMES = ["organizations:events-v2", "organizations:transaction-events"]


def all_events_query(**kwargs):
    options = {
        "sort": ["-timestamp"],
        "field": ["title", "event.type", "project", "user", "timestamp"],
        "tag": ["event.type", "release", "project.name", "user.email", "user.ip", "environment"],
        "name": ["All Events"],
        "fieldnames": ["title", "type", "project", "user", "time"],
    }
    options.update(kwargs)

    return urlencode(options, doseq=True)


def errors_query(**kwargs):
    options = {
        "sort": ["-last_seen", "-title"],
        "name": ["Errors"],
        "fieldnames": ["error", "events", "users", "project", "last seen"],
        "field": ["title", "count(id)", "count_unique(user)", "project", "last_seen"],
        "tag": ["error.type", "project.name"],
        "query": ["event.type:error"],
    }
    options.update(kwargs)

    return urlencode(options, doseq=True)


def transactions_query(**kwargs):
    options = {
        "sort": ["-count"],
        "name": ["Transactions"],
        "fieldnames": ["transaction", "project", "volume"],
        "field": ["transaction", "project", "count()"],
        "tag": ["release", "project.name", "user.email", "user.ip", "environment"],
        "statsPeriod": ["14d"],
        "query": ["event.type:transaction"],
    }
    options.update(kwargs)

    return urlencode(options, doseq=True)


def generate_transaction():
    from datetime import timedelta

    event_data = load_data("transaction")

    # set timestamps

    start_datetime = before_now(minutes=1)
    end_datetime = start_datetime + timedelta(milliseconds=500)
    span_end_datetime = start_datetime + timedelta(milliseconds=250)

    def generate_timestamp(date_time):
        import time

        return time.mktime(date_time.utctimetuple()) + date_time.microsecond / 1e6

    event_data["breadcrumbs"]["values"][0]["timestamp"] = generate_timestamp(start_datetime)
    event_data["start_timestamp"] = generate_timestamp(start_datetime)
    event_data["timestamp"] = generate_timestamp(end_datetime)

    # generate and build up span tree

    reference_span = event_data["spans"][0]
    parent_span_id = reference_span["parent_span_id"]

    span_tree_blueprint = {
        "a": {"aa": {"aaa": {"aaaa": "aaaaa"}}},
        "b": {},
        "c": {},
        "d": {},
        "e": {},
    }

    def build_span_tree(span_tree, spans, parent_span_id):
        import copy
        import six

        for span_id, child in span_tree.items():

            span = copy.deepcopy(reference_span)
            # non-leaf node span
            span["parent_span_id"] = parent_span_id.ljust(16, "0")
            span["span_id"] = span_id.ljust(16, "0")
            span["start_timestamp"] = generate_timestamp(start_datetime)
            span["timestamp"] = generate_timestamp(span_end_datetime)
            spans.append(span)

            if isinstance(child, dict):
                spans = build_span_tree(child, spans, span_id)
            elif isinstance(child, six.string_types):
                span = copy.deepcopy(reference_span)
                # leaf node span
                span["parent_span_id"] = span_id.ljust(16, "0")
                span["span_id"] = child.ljust(16, "0")
                span["start_timestamp"] = generate_timestamp(start_datetime)
                span["timestamp"] = generate_timestamp(span_end_datetime)
                spans.append(span)

        return spans

    event_data["spans"] = build_span_tree(span_tree_blueprint, [], parent_span_id)

    return event_data


class OrganizationEventsV2Test(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsV2Test, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=None, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.login_as(self.user)
        self.path = u"/organizations/{}/eventsv2/".format(self.org.slug)

    def wait_until_loaded(self):
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    def test_events_default_landing(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path)
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - default landing")

    def test_all_events_query_empty_state(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path + "?" + all_events_query())
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - all events query - empty state")

        with self.feature(FEATURE_NAMES):
            # expect table to expand to the right when no tags are provided
            self.browser.get(self.path + "?" + all_events_query(tag=[]))
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - all events query - empty state - no tags")

    @patch("django.utils.timezone.now")
    def test_all_events_query(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path + "?" + all_events_query())
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - all events query - list")

        with self.feature(FEATURE_NAMES):
            # expect table to expand to the right when no tags are provided
            self.browser.get(self.path + "?" + all_events_query(tag=[]))
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - all events query - list - no tags")

    def test_errors_query_empty_state(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path + "?" + errors_query)
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - errors query - empty state")

            self.browser.click_when_visible('[data-test-id="grid-edit-enable"]')
            self.browser.snapshot(
                "events-v2 - errors query - empty state - querybuilder - column edit state"
            )

            self.browser.click_when_visible('[data-test-id="grid-add-column-right-end"]')
            self.browser.snapshot(
                "events-v2 - errors query - empty state - querybuilder - add column"
            )

    @patch("django.utils.timezone.now")
    def test_errors_query(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "type": "error",
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "type": "error",
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "this is bad.",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
                "type": "error",
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path + "?" + error_view)
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - errors")

    @patch("django.utils.timezone.now")
    def test_event_detail_view_from_all_events(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)
        min_ago = iso_format(before_now(minutes=1))

        event_data = load_data("python")
        event_data.update(
            {
                "event_id": "a" * 32,
                "timestamp": min_ago,
                "received": min_ago,
                "fingerprint": ["group-1"],
            }
        )
        event = self.store_event(
            data=event_data, project_id=self.project.id, assert_no_errors=False
        )

        with self.feature(FEATURE_NAMES):
            # Get the list page.
            self.browser.get(self.path + "?" + all_view)
            self.wait_until_loaded()

            # Click the event link to open the events detail view
            self.browser.element('[aria-label="{}"]'.format(event.title)).click()
            self.wait_until_loaded()

            header = self.browser.element('[data-test-id="event-header"] span')
            assert event_data["message"] in header.text

            self.browser.snapshot("events-v2 - single error details view")

    @patch("django.utils.timezone.now")
    def test_event_detail_view_from_errors_view(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)
        event_source = (("a", 1), ("b", 39), ("c", 69))
        event_ids = []
        event_data = load_data("javascript")
        event_data["fingerprint"] = ["group-1"]
        for id_prefix, offset in event_source:
            event_time = iso_format(before_now(minutes=offset))
            event_data.update(
                {
                    "timestamp": event_time,
                    "received": event_time,
                    "event_id": id_prefix * 32,
                    "type": "error",
                }
            )
            event = self.store_event(data=event_data, project_id=self.project.id)
            event_ids.append(event.event_id)

        with self.feature(FEATURE_NAMES):
            # Get the list page
            self.browser.get(self.path + "?" + errors_query + "&statsPeriod=24h")
            self.wait_until_loaded()

            # Click the event link to open the event detail view
            self.browser.element('[aria-label="{}"]'.format(event.title)).click()
            self.wait_until_loaded()

            self.browser.snapshot("events-v2 - grouped error event detail view")

            # Check that the newest event is loaded first and that pagination
            # controls display
            display_id = self.browser.element('[data-test-id="event-id"]')
            assert event_ids[0] in display_id.text

            assert self.browser.element_exists_by_test_id("older-event")
            assert self.browser.element_exists_by_test_id("newer-event")

    def test_transactions_query_empty_state(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path + "?" + transactions_query)
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - transactions query - empty state")

    @patch("django.utils.timezone.now")
    def test_transactions_query(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        event_data = generate_transaction()

        self.store_event(data=event_data, project_id=self.project.id, assert_no_errors=True)

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path + "?" + transactions_query)
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - transactions query - list")

    @patch("django.utils.timezone.now")
    def test_modal_from_transactions_query(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        event_data = generate_transaction()

        event = self.store_event(data=event_data, project_id=self.project.id, assert_no_errors=True)

        with self.feature(FEATURE_NAMES):
            # Get the list page
            self.browser.get(self.path + "?" + transactions_query)
            self.wait_until_loaded()

            # Click the event link to open the modal
            self.browser.element('[aria-label="{}"]'.format(event.title)).click()
            self.wait_until_loaded()

            self.browser.snapshot("events-v2 - transactions query - modal")

    # TODO: deferred
    # @patch("django.utils.timezone.now")
    # def test_usage(self, mock_now):
    #     mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

    #     # TODO: load events

    #     # go to landing

    #     # go to a precanned query

    #     # save query 1

    #     # add environment column

    #     # update query

    #     # add condition from facet map

    #     # delete a column

    #     # click and drag a column

    #     # save as query 2

    #     # load save query 1

    #     # sort column

    #     # update query

    #     # delete save query 1
