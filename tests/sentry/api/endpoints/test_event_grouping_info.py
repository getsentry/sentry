from unittest import mock

from django.urls import reverse

from sentry.event_manager import EventManager
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType
from sentry.utils import json
from sentry.utils.performance_issues.performance_detection import (
    EventPerformanceProblem,
    PerformanceProblem,
)
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
        data = load_data(
            platform="transaction-n-plus-one",
        )
        fingerprint = data["hashes"][0]
        data["fingerprint"] = [fingerprint]

        manager = EventManager(data)
        manager.normalize()

        def inject_performance_problems(jobs, _):
            for job in jobs:
                job["performance_problems"] = []
                for f in job["data"]["fingerprint"]:
                    job["performance_problems"].append(
                        PerformanceProblem(
                            fingerprint=fingerprint,
                            op="db",
                            desc="N+1",
                            type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
                            parent_span_ids=["892612d95b7e094a"],
                            cause_span_ids=None,
                            offender_span_ids=[
                                "af0b6c143281fdee",
                                "a693d2937451761e",
                                "98b5f935ab2ce5ad",
                            ],
                        )
                    )

        with mock.patch(
            "sentry.event_manager._detect_performance_problems", inject_performance_problems
        ):
            event = manager.save(self.project.id)
            for group in event.groups:
                group.save()

        problem = PerformanceProblem.from_dict(
            {
                "fingerprint": "group1",
                "op": "db",
                "desc": "N+1",
                "type": GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
                "parent_span_ids": ["892612d95b7e094a"],
                "cause_span_ids": None,
                "offender_span_ids": ["af0b6c143281fdee", "a693d2937451761e", "98b5f935ab2ce5ad"],
            }
        )

        EventPerformanceProblem(event, problem).save()

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
        ]
