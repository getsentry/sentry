from __future__ import absolute_import

import copy
import pytz
from sentry.utils.compat.mock import patch
from datetime import timedelta, datetime

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, timestamp_format
from tests.acceptance.test_organization_events_v2 import generate_transaction

FEATURE_NAMES = ["organizations:performance-view"]


class TransactionComparison(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(TransactionComparison, self).setUp()
        self.user = self.create_user("foo@example.com", is_superuser=True)
        self.org = self.create_organization(name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.login_as(self.user)

    def wait_until_loaded(self):
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    @patch("django.utils.timezone.now")
    def test_transaction_comparison(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        baseline_event_data = generate_transaction()
        baseline_event = self.store_event(
            data=baseline_event_data, project_id=self.project.id, assert_no_errors=True
        )
        baseline_event_slug = u"{}:{}".format(self.project.slug, baseline_event.event_id)

        regression_event_data = generate_transaction()
        regression_event_data.update({"event_id": "b" * 32})

        regression_event_data["spans"] = regress_spans(regression_event_data["spans"])

        regression_event = self.store_event(
            data=regression_event_data, project_id=self.project.id, assert_no_errors=True
        )
        regression_event_slug = u"{}:{}".format(self.project.slug, regression_event.event_id)

        comparison_page_path = u"/organizations/{}/performance/compare/{}/{}/".format(
            self.org.slug, baseline_event_slug, regression_event_slug
        )

        with self.feature(FEATURE_NAMES):
            self.browser.get(comparison_page_path)
            self.wait_until_loaded()

            # screenshot for un-expanded span details are visually different from
            # when a matched span is expanded
            self.browser.snapshot("transaction comparison page")

            self.browser.elements('[data-test-id="span-row"]')[0].click()
            self.browser.elements('[data-test-id="span-row"]')[1].click()
            self.browser.elements('[data-test-id="span-row"]')[2].click()
            self.browser.elements('[data-test-id="span-row"]')[10].click()

            self.browser.snapshot("transaction comparison page - expanded span details")


def regress_spans(original_spans):
    spans = []
    last_index = len(original_spans) - 1
    for index, reference_span in enumerate(original_spans):
        end_datetime = datetime.utcfromtimestamp(reference_span["timestamp"]).replace(
            tzinfo=pytz.utc
        )
        span = copy.deepcopy(reference_span)
        if index % 2 == 0:
            # for every even indexed span, increase its duration.
            # this implies the span was slower.
            regression_time = timedelta(milliseconds=10 + index)
            span["timestamp"] = timestamp_format(end_datetime + regression_time)
        else:
            # for every odd indexed span, decrease its duration.
            # this implies the span was faster
            regression_time = timedelta(milliseconds=5 + index)
            span["timestamp"] = timestamp_format(end_datetime - regression_time)

        if index == last_index:
            # change the op name of the last span.
            # the last span would be removed from the baseline transaction;
            # and the last span of the baseline transaction would be missing from
            # the regression transaction
            span["op"] = "resource"

        spans.append(span)
    return spans
