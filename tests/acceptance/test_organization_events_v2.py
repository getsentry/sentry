from __future__ import absolute_import

import pytz
from mock import patch

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.utils.samples import load_data
from sentry.testutils.helpers.datetime import iso_format, before_now


FEATURE_NAME = "organizations:events-v2"

all_view = 'field=%5B"title"%2C"title"%5D&field=%5B"event.type"%2C"type"%5D&field=%5B"project"%2C"project"%5D&field=%5B"user"%2C"user"%5D&field=%5B"timestamp"%2C"time"%5D&name=All+Events&sort=-timestamp&tag=event.type&tag=release&tag=project.name&tag=user.email&tag=user.ip&tag=environment'
error_view = 'field=%5B"title"%2C"error"%5D&field=%5B"count%28id%29"%2C"events"%5D&field=%5B"count_unique%28user%29"%2C"users"%5D&field=%5B"project"%2C"project"%5D&field=%5B"last_seen"%2C"last+seen"%5D&name=Errors&query=event.type%3Aerror&sort=-last_seen&sort=-title&tag=error.type&tag=project.name'


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

    def test_all_events_empty(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path + "?" + all_view)
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - all events empty state")

    @patch("django.utils.timezone.now")
    def test_all_events(self, mock_now):
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

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path + "?" + all_view)
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - all events")

    @patch("django.utils.timezone.now")
    def test_errors(self, mock_now):
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
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
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
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path + "?" + error_view)
            self.wait_until_loaded()
            self.browser.snapshot("events-v2 - errors")

    @patch("django.utils.timezone.now")
    def test_modal_from_all_events(self, mock_now):
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

        with self.feature(FEATURE_NAME):
            # Get the list page.
            self.browser.get(self.path + "?" + all_view)
            self.wait_until_loaded()

            # Click the event link to open the modal
            self.browser.element('[aria-label="{}"]'.format(event.title)).click()
            self.wait_until_loaded()

            header = self.browser.element('[data-test-id="modal-dialog"] h2')
            assert event_data["message"] in header.text

            issue_link = self.browser.element('[data-test-id="linked-issue"]')
            issue_event_url_fragment = "/issues/%s/events/%s/" % (event.group_id, event.event_id)
            assert issue_event_url_fragment in issue_link.get_attribute("href")

            self.browser.snapshot("events-v2 - single error modal")

    @patch("django.utils.timezone.now")
    def test_modal_from_errors_view(self, mock_now):
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

        with self.feature(FEATURE_NAME):

            # Get the list page
            self.browser.get(self.path + "?" + error_view + "&statsPeriod=24h")
            self.wait_until_loaded()

            # Click the event link to open the modal
            self.browser.element('[aria-label="{}"]'.format(event.title)).click()
            self.wait_until_loaded()

            self.browser.snapshot("events-v2 - grouped error modal")

            # Check that the newest event is loaded first and that pagination
            # controls display
            display_id = self.browser.element('[data-test-id="event-id"]')
            assert event_ids[0] in display_id.text

            assert self.browser.element_exists_by_test_id("older-event")
            assert self.browser.element_exists_by_test_id("newer-event")
