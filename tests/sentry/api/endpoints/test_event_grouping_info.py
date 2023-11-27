import pytest
from django.urls import reverse

from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


@region_silo_test
class EventGroupingInfoEndpointTestCase(APITestCase, PerformanceIssueTestCase):
    def setUp(self):
        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )

    def test_error_event(self):
        data = load_data(platform="javascript")
        event = self.store_event(data=data, project_id=self.project.id)

        url = reverse(
            "sentry-api-0-event-grouping-info",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event.event_id,
            },
        )

        response = self.client.get(url, format="json")
        content = json.loads(response.content)

        assert response.status_code == 200
        assert content["system"]["type"] == "component"

    def test_transaction_event(self):
        data = load_data(platform="transaction")
        event = self.store_event(data=data, project_id=self.project.id)

        url = reverse(
            "sentry-api-0-event-grouping-info",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event.event_id,
            },
        )

        response = self.client.get(url, format="json")
        content = json.loads(response.content)

        assert response.status_code == 200
        assert content == {}

    @pytest.mark.skip("We no longer return perf issue info from the grouping info endpoint")
    def test_transaction_event_with_problem(self):
        event = self.create_performance_issue()
        url = reverse(
            "sentry-api-0-event-grouping-info",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event.event_id,
            },
        )

        response = self.client.get(url, format="json")
        content = json.loads(response.content)

        assert response.status_code == 200
        assert content["performance_n_plus_one_db_queries"]["type"] == "performance-problem"
        assert content["performance_n_plus_one_db_queries"]["evidence"]["parent_span_hashes"] == [
            "6a992d5529f459a4"
        ]
        assert content["performance_n_plus_one_db_queries"]["evidence"]["offender_span_hashes"] == [
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
        ]
