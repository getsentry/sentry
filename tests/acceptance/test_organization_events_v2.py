from __future__ import absolute_import

import copy
import six
import pytest
import pytz
from sentry.utils.compat.mock import patch
from datetime import timedelta

from six.moves.urllib.parse import urlencode
from selenium.webdriver.common.keys import Keys

from sentry.discover.models import DiscoverSavedQuery
from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.utils.samples import load_data
from sentry.testutils.helpers.datetime import iso_format, before_now, timestamp_format


FEATURE_NAMES = [
    "organizations:discover-basic",
    "organizations:discover-query",
    "organizations:performance-view",
]


def all_events_query(**kwargs):
    options = {
        "sort": ["-timestamp"],
        "field": ["title", "event.type", "project", "user.display", "timestamp"],
        "name": ["All Events"],
    }
    options.update(kwargs)

    return urlencode(options, doseq=True)


def errors_query(**kwargs):
    options = {
        "sort": ["-title"],
        "name": ["Errors"],
        "field": ["title", "count(id)", "count_unique(user)", "project"],
        "query": ["event.type:error"],
    }
    options.update(kwargs)

    return urlencode(options, doseq=True)


def transactions_query(**kwargs):
    options = {
        "sort": ["-count"],
        "name": ["Transactions"],
        "field": ["transaction", "project", "count()"],
        "statsPeriod": ["14d"],
        "query": ["event.type:transaction"],
    }
    options.update(kwargs)

    return urlencode(options, doseq=True)


def generate_transaction():
    start_datetime = before_now(minutes=1, milliseconds=500)
    end_datetime = before_now(minutes=1)
    event_data = load_data("transaction", timestamp=end_datetime, start_timestamp=start_datetime)
    event_data.update({"event_id": "a" * 32})

    # generate and build up span tree
    reference_span = event_data["spans"][0]
    parent_span_id = reference_span["parent_span_id"]

    span_tree_blueprint = {
        "a": {},
        "b": {"bb": {"bbb": {"bbbb": "bbbbb"}}},
        "c": {},
        "d": {},
        "e": {},
    }

    time_offsets = {
        "a": (timedelta(), timedelta(milliseconds=10)),
        "b": (timedelta(milliseconds=120), timedelta(milliseconds=250)),
        "bb": (timedelta(milliseconds=130), timedelta(milliseconds=10)),
        "bbb": (timedelta(milliseconds=140), timedelta(milliseconds=10)),
        "bbbb": (timedelta(milliseconds=150), timedelta(milliseconds=10)),
        "bbbbb": (timedelta(milliseconds=160), timedelta(milliseconds=90)),
        "c": (timedelta(milliseconds=260), timedelta(milliseconds=100)),
        "d": (timedelta(milliseconds=375), timedelta(milliseconds=50)),
        "e": (timedelta(milliseconds=400), timedelta(milliseconds=100)),
    }

    def build_span_tree(span_tree, spans, parent_span_id):
        for span_id, child in sorted(span_tree.items(), key=lambda item: item[0]):
            span = copy.deepcopy(reference_span)
            # non-leaf node span
            span["parent_span_id"] = parent_span_id.ljust(16, "0")
            span["span_id"] = span_id.ljust(16, "0")

            (start_delta, span_length) = time_offsets.get(span_id, (timedelta(), timedelta()))

            span_start_time = start_datetime + start_delta
            span["start_timestamp"] = timestamp_format(span_start_time)
            span["timestamp"] = timestamp_format(span_start_time + span_length)
            spans.append(span)

            if isinstance(child, dict):
                spans = build_span_tree(child, spans, span_id)
            elif isinstance(child, six.string_types):
                parent_span_id = span_id
                span_id = child

                span = copy.deepcopy(reference_span)
                # leaf node span
                span["parent_span_id"] = parent_span_id.ljust(16, "0")
                span["span_id"] = span_id.ljust(16, "0")

                (start_delta, span_length) = time_offsets.get(span_id, (timedelta(), timedelta()))

                span_start_time = start_datetime + start_delta
                span["start_timestamp"] = timestamp_format(span_start_time)
                span["timestamp"] = timestamp_format(span_start_time + span_length)
                spans.append(span)

        return spans

    event_data["spans"] = build_span_tree(span_tree_blueprint, [], parent_span_id)

    return event_data


class OrganizationEventsV2Test(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsV2Test, self).setUp()
        self.user = self.create_user("foo@example.com", is_superuser=True)
        self.org = self.create_organization(name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.login_as(self.user)
        self.landing_path = u"/organizations/{}/discover/queries/".format(self.org.slug)
        self.result_path = u"/organizations/{}/discover/results/".format(self.org.slug)

    def wait_until_loaded(self):
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    def test_events_default_landing(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.landing_path)
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - default landing")

    def test_all_events_query_empty_state(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.result_path + "?" + all_events_query())
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - all events query - empty state")

        with self.feature(FEATURE_NAMES):
            # expect table to expand to the right when no tags are provided
            self.browser.get(self.result_path + "?" + all_events_query(tag=[]))
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - all events query - empty state - no tags")

    @patch("django.utils.timezone.now")
    def test_all_events_query(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)
        min_ago = iso_format(before_now(minutes=1))
        two_min_ago = iso_format(before_now(minutes=2))
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "this is bad.",
                "timestamp": two_min_ago,
                "fingerprint": ["group-2"],
                "user": {
                    "id": "123",
                    "email": "someone@example.com",
                    "username": "haveibeenpwned",
                    "ip_address": "8.8.8.8",
                    "name": "Someone",
                },
            },
            project_id=self.project.id,
        )
        self.wait_for_event_count(2, self.project.id)

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.result_path + "?" + all_events_query())
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - all events query - list")

        with self.feature(FEATURE_NAMES):
            # expect table to expand to the right when no tags are provided
            self.browser.get(self.result_path + "?" + all_events_query(tag=[]))
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - all events query - list - no tags")

    def test_errors_query_empty_state(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.result_path + "?" + errors_query())
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - errors query - empty state")

            self.browser.click_when_visible('[data-test-id="grid-edit-enable"]')
            self.browser.snapshot(
                "events-v2 - errors query - empty state - querybuilder - column edit state"
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
            self.browser.get(self.result_path + "?" + errors_query())
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - errors")

    def test_transactions_query_empty_state(self):
        with self.feature(FEATURE_NAMES):
            self.browser.get(self.result_path + "?" + transactions_query())
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - transactions query - empty state")

        with self.feature(FEATURE_NAMES):
            # expect table to expand to the right when no tags are provided
            self.browser.get(self.result_path + "?" + transactions_query(tag=[]))
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - transactions query - empty state - no tags")

    @patch("django.utils.timezone.now")
    def test_transactions_query(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        event_data = generate_transaction()

        self.store_event(data=event_data, project_id=self.project.id, assert_no_errors=True)

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.result_path + "?" + transactions_query())
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - transactions query - list")

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
        self.store_event(data=event_data, project_id=self.project.id, assert_no_errors=False)

        with self.feature(FEATURE_NAMES):
            # Get the list page.
            self.browser.get(self.result_path + "?" + all_events_query())
            self.wait_until_loaded()

            # View Event
            self.browser.elements('[data-test-id="view-event"]')[0].click()
            self.wait_until_loaded()

            header = self.browser.element('[data-test-id="event-header"] span')
            assert event_data["message"] in header.text

            self.browser.snapshot("events-v2 - single error details view")

    @patch("django.utils.timezone.now")
    def test_event_detail_view_from_errors_view(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        event_data = load_data("javascript")
        event_data.update(
            {
                "timestamp": iso_format(before_now(minutes=5)),
                "event_id": "d" * 32,
                "fingerprint": ["group-1"],
            }
        )
        self.store_event(data=event_data, project_id=self.project.id)

        with self.feature(FEATURE_NAMES):
            # Get the list page
            self.browser.get(self.result_path + "?" + errors_query() + "&statsPeriod=24h")
            self.wait_until_loaded()

            # Open the stack
            self.browser.element('[data-test-id="open-stack"]').click()
            self.wait_until_loaded()

            # View Event
            self.browser.elements('[data-test-id="view-event"]')[0].click()
            self.wait_until_loaded()

            self.browser.snapshot("events-v2 - error event detail view")

    @patch("django.utils.timezone.now")
    def test_event_detail_view_from_transactions_query(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        event_data = generate_transaction()
        self.store_event(data=event_data, project_id=self.project.id, assert_no_errors=True)

        # Create a child event that is linked to the parent so we have coverage
        # of traversal buttons.
        child_event = generate_transaction()
        child_event["event_id"] = "b" * 32
        child_event["contexts"]["trace"]["parent_span_id"] = event_data["spans"][4]["span_id"]
        child_event["transaction"] = "z-child-transaction"
        child_event["spans"] = child_event["spans"][0:3]
        self.store_event(data=child_event, project_id=self.project.id, assert_no_errors=True)

        with self.feature(FEATURE_NAMES):
            # Get the list page
            self.browser.get(self.result_path + "?" + transactions_query())
            self.wait_until_loaded()

            # Open the stack
            self.browser.elements('[data-test-id="open-stack"]')[0].click()
            self.wait_until_loaded()

            # View Event
            self.browser.elements('[data-test-id="view-event"]')[0].click()
            self.wait_until_loaded()

            # Open a span detail so we can check the search by trace link.
            # Click on the 6th one as a missing instrumentation span is inserted.
            self.browser.elements('[data-test-id="span-row"]')[6].click()

            # Wait until the child event loads.
            child_button = '[data-test-id="view-child-transaction"]'
            self.browser.wait_until(child_button)
            self.browser.snapshot("events-v2 - transactions event detail view")

            # Click on the child transaction.
            self.browser.click(child_button)
            self.wait_until_loaded()

    def test_create_saved_query(self):
        # Simulate a custom query
        query = {"field": ["project.id", "count()"], "query": "event.type:error"}
        query_name = "A new custom query"
        with self.feature(FEATURE_NAMES):
            # Go directly to the query builder view
            self.browser.get(self.result_path + "?" + urlencode(query, doseq=True))
            self.wait_until_loaded()

            # Open the save as drawer
            self.browser.element('[data-test-id="button-save-as"]').click()

            # Fill out name and submit form.
            self.browser.element('input[name="query_name"]').send_keys(query_name)
            self.browser.element('[data-test-id="button-save-query"]').click()

            self.browser.wait_until(
                'div[name="discover2-query-name"][value="{}"]'.format(query_name)
            )

            # Page title should update.
            title_input = self.browser.element('div[name="discover2-query-name"]')
            assert title_input.get_attribute("value") == query_name
        # Saved query should exist.
        assert DiscoverSavedQuery.objects.filter(name=query_name).exists()

    def test_view_and_rename_saved_query(self):
        # Create saved query to rename
        query = DiscoverSavedQuery.objects.create(
            name="Custom query",
            organization=self.org,
            version=2,
            query={"fields": ["title", "project.id", "count()"], "query": "event.type:error"},
        )
        with self.feature(FEATURE_NAMES):
            # View the query list
            self.browser.get(self.landing_path)
            self.wait_until_loaded()

            # Look at the results for our query.
            self.browser.element('[data-test-id="card-{}"]'.format(query.name)).click()
            self.wait_until_loaded()

            input = self.browser.element('div[name="discover2-query-name"]')
            input.click()
            input.send_keys(Keys.END + "updated!")

            # Move focus somewhere else to trigger a blur and update the query
            self.browser.element("table").click()

            new_name = "Custom queryupdated!"
            new_card_selector = 'div[name="discover2-query-name"][value="{}"]'.format(new_name)
            self.browser.wait_until(new_card_selector)

        # Assert the name was updated.
        assert DiscoverSavedQuery.objects.filter(name=new_name).exists()

    def test_delete_saved_query(self):
        # Create saved query with ORM
        query = DiscoverSavedQuery.objects.create(
            name="Custom query",
            organization=self.org,
            version=2,
            query={"fields": ["title", "project.id", "count()"], "query": "event.type:error"},
        )
        with self.feature(FEATURE_NAMES):
            # View the query list
            self.browser.get(self.landing_path)
            self.wait_until_loaded()

            # Get the card with the new query
            card_selector = '[data-test-id="card-{}"]'.format(query.name)
            card = self.browser.element(card_selector)

            # Open the context menu
            card.find_element_by_css_selector('[data-test-id="context-menu"]').click()
            # Delete the query
            card.find_element_by_css_selector('[data-test-id="delete-query"]').click()

            # Wait for card to clear
            self.browser.wait_until_not(card_selector)

            assert DiscoverSavedQuery.objects.filter(name=query.name).exists() is False

    def test_duplicate_query(self):
        # Create saved query with ORM
        query = DiscoverSavedQuery.objects.create(
            name="Custom query",
            organization=self.org,
            version=2,
            query={"fields": ["title", "project.id", "count()"], "query": "event.type:error"},
        )
        with self.feature(FEATURE_NAMES):
            # View the query list
            self.browser.get(self.landing_path)
            self.wait_until_loaded()

            # Get the card with the new query
            card_selector = '[data-test-id="card-{}"]'.format(query.name)
            card = self.browser.element(card_selector)

            # Open the context menu, and duplicate
            card.find_element_by_css_selector('[data-test-id="context-menu"]').click()
            card.find_element_by_css_selector('[data-test-id="duplicate-query"]').click()

            duplicate_name = "{} copy".format(query.name)
            # Wait for new element to show up.
            self.browser.element('[data-test-id="card-{}"]'.format(duplicate_name))
        # Assert the new query exists and has 'copy' added to the name.
        assert DiscoverSavedQuery.objects.filter(name=duplicate_name).exists()

    @pytest.mark.skip(reason="causing timeouts in github actions and travis")
    @patch("django.utils.timezone.now")
    def test_drilldown_result(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)
        min_ago = iso_format(before_now(minutes=1))
        events = (
            ("a" * 32, "oh no", "group-1"),
            ("b" * 32, "oh no", "group-1"),
            ("c" * 32, "this is bad", "group-2"),
        )
        for event in events:
            self.store_event(
                data={
                    "event_id": event[0],
                    "message": event[1],
                    "timestamp": min_ago,
                    "fingerprint": [event[2]],
                    "type": "error",
                },
                project_id=self.project.id,
            )

        query = {"field": ["message", "project", "count()"], "query": "event.type:error"}
        with self.feature(FEATURE_NAMES):
            # Go directly to the query builder view
            self.browser.get(self.result_path + "?" + urlencode(query, doseq=True))
            self.wait_until_loaded()

            # Click the first drilldown
            self.browser.element('[data-test-id="expand-count"]').click()
            self.wait_until_loaded()

            assert self.browser.element_exists_by_test_id("grid-editable"), "table should exist."
            headers = self.browser.elements('[data-test-id="grid-editable"] thead th')
            expected = ["", "MESSAGE", "PROJECT", "ID"]
            actual = [header.text for header in headers]
            assert expected == actual

    @pytest.mark.skip(reason="not done")
    @patch("django.utils.timezone.now")
    def test_usage(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        # TODO: load events

        # go to landing

        # go to a precanned query

        # save query 1

        # add environment column

        # update query

        # add condition from facet map

        # delete a column

        # click and drag a column

        # save as query 2

        # load save query 1

        # sort column

        # update query

        # delete save query 1
