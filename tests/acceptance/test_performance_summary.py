from typing import Any
from unittest.mock import MagicMock, patch
from urllib.parse import urlencode

import pytest

from fixtures.page_objects.transaction_summary import TransactionSummaryPage
from sentry.models.assistant import AssistantActivity
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import no_silo_test
from sentry.utils.samples import load_data

FEATURES = {"organizations:performance-view": True}

pytestmark = pytest.mark.sentry_metrics


def make_event(event_data: dict[str, Any]) -> dict[str, object]:
    event_data["event_id"] = "c" * 32
    event_data["contexts"]["trace"]["trace_id"] = "a" * 32
    return event_data


@no_silo_test
class PerformanceSummaryTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = "/organizations/{}/performance/summary/?{}".format(
            self.org.slug,
            urlencode({"transaction": "/country_by_code/", "project": self.project.id}),
        )

        AssistantActivity.objects.create(
            user=self.user, guide_id=20, viewed_ts=before_now(minutes=1)
        )

        self.page = TransactionSummaryPage(self.browser)

    @patch("django.utils.timezone.now")
    def test_transaction_threshold_modal(self, mock_now: MagicMock) -> None:
        mock_now.return_value = before_now()

        # Create a transaction
        event = make_event(load_data("transaction", timestamp=before_now(minutes=3)))
        self.store_event(data=event, project_id=self.project.id)

        self.store_event(
            data={
                "transaction": "/country_by_code/",
                "message": "This is bad",
                "event_id": "b" * 32,
                "timestamp": before_now(minutes=3).isoformat(),
            },
            project_id=self.project.id,
        )

        with self.feature(FEATURES):
            self.browser.get(self.path)
            self.page.wait_until_loaded()
            self.browser.click('[data-test-id="set-transaction-threshold"]')
