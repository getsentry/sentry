from __future__ import absolute_import

import pytz
from sentry.utils.compat.mock import patch

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class OrganizationDiscoverTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationDiscoverTest, self).setUp()

        self.login_as(user=self.user, superuser=False)

        self.org = self.create_organization(owner=self.user, name="foo")

        self.project = self.create_project(organization=self.org, name="Bengal")
        sec_ago = iso_format(before_now(seconds=1))

        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "platform": "python",
                "environment": "staging",
                "fingerprint": ["group_1"],
                "message": "message!",
                "tags": {"sentry:release": "foo"},
                "exception": {
                    "values": [
                        {
                            "type": "ValidationError",
                            "value": "Bad request",
                            "mechanism": {"type": "1", "value": "1"},
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "?",
                                        "filename": "http://localhost:1337/error.js",
                                        "lineno": 29,
                                        "colno": 3,
                                        "in_app": False,
                                    }
                                ]
                            },
                        }
                    ]
                },
                "timestamp": sec_ago,
            },
            project_id=self.project.id,
        )
        self.path = u"/organizations/{}/discover/".format(self.org.slug)

    def test_no_access(self):
        with self.feature(
            {"organizations:discover-basic": False, "organizations:discover-query": False}
        ):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading")
            self.browser.snapshot("discover - no access")

    def test_query_builder(self):
        with self.feature("organizations:discover"):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading")
            self.browser.wait_until_not(".is-disabled")
            self.browser.snapshot("discover - query builder")

    @patch("django.utils.timezone.now")
    def test_run_query(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)
        with self.feature("organizations:discover"):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading")
            self.browser.click_when_visible('[aria-label="Run"]')
            self.browser.wait_until_not(".loading")
            self.browser.wait_until_test_id("result")
            self.browser.snapshot("discover - query results")

    def test_save_query_edit(self):
        with self.feature("organizations:discover"):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading")
            self.browser.find_element_by_xpath("//button//span[contains(text(), 'Save')]").click()
            self.browser.get(self.path + "saved/1/?editing=true")
            self.browser.wait_until_test_id("result")
            self.browser.wait_until_not(".loading")
            self.browser.snapshot("discover - saved query")

    def test_saved_query_list(self):
        with self.feature("organizations:discover"):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading")
            self.browser.find_element_by_xpath("//button//span[contains(text(), 'Save')]").click()
            self.browser.get(self.path + "?view=saved")
            self.browser.wait_until_test_id("result")
            self.browser.wait_until_not(".loading")
            self.browser.snapshot("discover - saved query list")
