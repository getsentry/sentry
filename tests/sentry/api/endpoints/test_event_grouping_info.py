from django.urls import reverse

from sentry.event_manager import EventManager
from sentry.testutils import APITestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType
from sentry.utils import json
from sentry.utils.samples import load_data


@region_silo_test
class EventGroupingInfoEndpointTestCase(APITestCase):
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

    def test_transaction_event_with_problem(self):
        event_data = load_data(
            "transaction-n-plus-one",
            fingerprint=[f"{GroupType.PERFORMANCE_N_PLUS_ONE.value}-group1"],
        )
        perf_event_manager = EventManager(event_data)
        perf_event_manager.normalize()
        with override_options(
            {
                "performance.issues.all.problem-creation": 1.0,
                "performance.issues.all.problem-detection": 1.0,
                "performance.issues.n_plus_one_db.problem-creation": 1.0,
            }
        ), self.feature(
            [
                "organizations:performance-issues-ingest",
                "projects:performance-suspect-spans-ingestion",
            ]
        ):
            event = perf_event_manager.save(self.project.id)
        event = event.for_group(event.groups[0])
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
        assert content["PERFORMANCE_N_PLUS_ONE_DB_QUERIES"]["type"] == "performance-problem"
        assert content["PERFORMANCE_N_PLUS_ONE_DB_QUERIES"]["evidence"]["parent_span_hashes"] == [
            "6a992d5529f459a4"
        ]
        assert content["PERFORMANCE_N_PLUS_ONE_DB_QUERIES"]["evidence"]["offender_span_hashes"] == [
            "63f1e89e6a073441",
            "63f1e89e6a073441",
            "63f1e89e6a073441",
            "63f1e89e6a073441",
            "63f1e89e6a073441",
            "63f1e89e6a073441",
            "63f1e89e6a073441",
            "63f1e89e6a073441",
            "63f1e89e6a073441",
            "63f1e89e6a073441",
        ]
