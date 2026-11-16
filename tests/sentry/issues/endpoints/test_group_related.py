from datetime import timedelta
from typing import Any
from unittest import mock
from uuid import uuid4

import orjson
from django.test import override_settings
from urllib3.response import HTTPResponse

from sentry.api.serializers import serialize
from sentry.incidents.grouptype import MetricIssue
from sentry.issues.endpoints.group_related import ALL_TYPES_UNAVAILABLE_DETAIL
from sentry.issues.related.contributing import (
    NOT_A_METRIC_ISSUE_DETAIL,
    UNSUPPORTED_DATASET_DETAIL,
    UNSUPPORTED_QUERY_DETAIL,
)
from sentry.issues.related.same_trace import NO_TRACE_DETAIL, TRACE_SEARCH_UNAVAILABLE_DETAIL
from sentry.issues.related.similar_stacktrace import (
    NO_STACKTRACE_DETAIL,
    NOT_AN_ERROR_DETAIL,
    SIMILARITY_DISABLED_DETAIL,
    SIMILARITY_UNAVAILABLE_DETAIL,
)
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options
from sentry.utils.snuba import QueryExecutionError
from tests.sentry.issues.test_utils import SearchIssueTestMixin

TRACE_ID = "a7d67cf796774551a95be6543cacd459"


def trace_contexts(trace_id: str = TRACE_ID) -> dict[str, dict[str, str]]:
    return {"trace": {"trace_id": trace_id, "span_id": "babaae0d4b7512d9", "type": "trace"}}


ERROR_EVENT_DATA = {
    "contexts": trace_contexts(),
    "exception": {
        "values": [
            {
                "stacktrace": {
                    "frames": [
                        {
                            "function": "divide_by_zero",
                            "module": "__main__",
                            "filename": "python_onboarding.py",
                            "abs_path": "/Users/jodi/python_onboarding/python_onboarding.py",
                            "lineno": 20,
                            "context_line": " divide = 1/0",
                            "in_app": True,
                        },
                    ]
                },
                "type": "ZeroDivisionError",
                "value": "division by zero",
            }
        ]
    },
    "platform": "python",
}

# Only external services are mocked: Seer's HTTP call, and a Snuba query when a test needs it to
# fail.
SEER_URLOPEN = "sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen"
TRACE_SNUBA_QUERY = "sentry.issues.related.trace_connected.bulk_snuba_queries"
ISSUE_SEARCH_SNUBA_QUERY = "sentry.search.snuba.executors.bulk_raw_query"


def detector_query(**overrides: Any) -> dict[str, Any]:
    """A metric detector's query, as a metric issue's event records it."""
    return {
        "dataset": "events",
        "query": "transaction:/checkout",
        "aggregate": "count()",
        "time_window": 60,
        "environment": None,
        "event_types": ["error", "default"],
        **overrides,
    }


def seer_response(*matches: tuple[str, float]) -> HTTPResponse:
    responses = [
        {"parent_hash": parent_hash, "should_group": True, "stacktrace_distance": distance}
        for parent_hash, distance in matches
    ]
    return HTTPResponse(orjson.dumps({"responses": responses}), status=200)


class GroupRelatedEndpointTest(APITestCase, SnubaTestCase, SearchIssueTestMixin):
    def setUp(self) -> None:
        super().setUp()
        # Seer requests carry a ViewerContext signed with this secret; without it they fail.
        self.enterContext(override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret"))
        self.login_as(self.user)
        self.project.update_option("sentry:similarity_backfill_completed", 1)
        self.event = self.store_event(data=ERROR_EVENT_DATA, project_id=self.project.id)
        assert self.event.group is not None
        self.group = self.event.group
        self.path = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/related/"

    def store_metric_issue(self, snuba_query: dict[str, Any]) -> tuple[Event, Group]:
        """
        A metric issue that opened five minutes ago. Its event records the detector's query in the
        evidence data, where detectors put it; the lookup reads nothing else from there.
        """
        event, _occurrence, group_info = self.store_search_issue(
            project_id=self.project.id,
            user_id=self.user.id,
            fingerprints=[uuid4().hex],
            insert_time=before_now(minutes=5),
            override_occurrence_data={
                # The event loads its occurrence by project, and the builder defaults to project 1
                "project_id": self.project.id,
                "type": MetricIssue.type_id,
                "evidence_data": {"data_sources": [{"query_obj": {"snuba_query": snuba_query}}]},
            },
        )
        assert group_info is not None
        return event, group_info.group

    @mock.patch(SEER_URLOPEN)
    def test_similar_issues(self, mock_seer_request: mock.MagicMock) -> None:
        similar_event = self.store_event(data={"message": "Dogs"}, project_id=self.project.id)
        other_event = self.store_event(data={"message": "Cats"}, project_id=self.project.id)
        assert similar_event.group is not None and other_event.group is not None
        # An issue can have several hashes (after a merge, say), and Seer can match more than one.
        # There's no fixture for adding a hash to an existing issue.
        second_hash = GroupHash.objects.create(
            project=self.project, group=similar_event.group, hash="a" * 32
        )
        mock_seer_request.return_value = seer_response(
            (self.event.get_primary_hash(), 0.0),  # the issue itself
            (similar_event.get_primary_hash(), 0.01),
            (other_event.get_primary_hash(), 0.05),
            (second_hash.hash, 0.10),  # a weaker match for an issue already found
        )

        response = self.client.get(self.path, {"type": "similar_stacktrace", "limit": "3"})

        assert response.status_code == 200
        # Reloaded: event processing updates the issue's row after store_event returns it.
        assert response.data == {
            "data": [
                {
                    "issue": serialize(Group.objects.get(id=similar_event.group.id), self.user),
                    "relations": [{"type": "similar_stacktrace", "score": 0.99}],
                },
                {
                    "issue": serialize(Group.objects.get(id=other_event.group.id), self.user),
                    "relations": [{"type": "similar_stacktrace", "score": 0.95}],
                },
            ],
            "meta": {
                "types": [
                    {"type": "similar_stacktrace", "status": "ok", "eventId": self.event.event_id}
                ]
            },
        }
        seer_request = orjson.loads(mock_seer_request.call_args.kwargs["body"])
        assert seer_request["event_id"] == self.event.event_id
        assert seer_request["k"] == 3

    @mock.patch(SEER_URLOPEN)
    def test_same_trace(self, mock_seer_request: mock.MagicMock) -> None:
        # Closed membership: a member can read only their own teams' projects
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        member = self.create_user()
        self.create_member(
            user=member, organization=self.organization, role="member", teams=[self.team]
        )
        other_project = self.create_project(organization=self.organization, teams=[self.team])
        hidden_project = self.create_project(
            organization=self.organization, teams=[self.create_team(organization=self.organization)]
        )
        server_event = self.store_event(
            data={
                "message": "Server error",
                "contexts": trace_contexts(),
                "timestamp": before_now(minutes=3).isoformat(),
            },
            project_id=self.project.id,
        )
        client_event = self.store_event(
            data={
                "message": "Client error",
                "contexts": trace_contexts(),
                "timestamp": before_now(minutes=2).isoformat(),
            },
            project_id=other_project.id,
        )
        # These two are in the past too, so they're left out for the reason under test and not
        # because the trace query's range ends before them (see the next test).
        self.store_event(
            data={
                "message": "Hidden error",
                "contexts": trace_contexts(),
                "timestamp": before_now(minutes=2).isoformat(),
            },
            project_id=hidden_project.id,
        )
        self.store_event(
            data={
                "message": "Error in another trace",
                "contexts": trace_contexts("b" * 32),
                "timestamp": before_now(minutes=2).isoformat(),
            },
            project_id=self.project.id,
        )
        assert server_event.group is not None and client_event.group is not None
        self.login_as(member)

        response = self.client.get(self.path, {"type": "same_trace"})

        assert response.status_code == 200
        # Most recently seen first
        assert response.data == {
            "data": [
                {
                    "issue": serialize(Group.objects.get(id=client_event.group.id), member),
                    "relations": [{"type": "same_trace"}],
                },
                {
                    "issue": serialize(Group.objects.get(id=server_event.group.id), member),
                    "relations": [{"type": "same_trace"}],
                },
            ],
            "meta": {
                "types": [
                    {
                        "type": "same_trace",
                        "status": "ok",
                        "eventId": self.event.event_id,
                        "traceId": TRACE_ID,
                    }
                ]
            },
        }
        mock_seer_request.assert_not_called()

        response = self.client.get(self.path, {"type": "same_trace", "limit": "1"})

        assert response.status_code == 200
        assert [item["issue"]["id"] for item in response.data["data"]] == [
            str(client_event.group.id)
        ]

    @mock.patch(SEER_URLOPEN)
    def test_issue_matched_by_both_types_comes_first(
        self, mock_seer_request: mock.MagicMock
    ) -> None:
        # A minute ago: the trace query's range ends at "now", in whole seconds, so an event from
        # the same second as the request can fall outside it.
        a_minute_ago = before_now(minutes=1).isoformat()
        both_event = self.store_event(
            data={
                "message": "Similar, same trace",
                "contexts": trace_contexts(),
                "timestamp": a_minute_ago,
            },
            project_id=self.project.id,
        )
        similar_event = self.store_event(data={"message": "Similar"}, project_id=self.project.id)
        trace_event = self.store_event(
            data={"message": "Same trace", "contexts": trace_contexts(), "timestamp": a_minute_ago},
            project_id=self.project.id,
        )
        mock_seer_request.return_value = seer_response(
            (similar_event.get_primary_hash(), 0.01),
            (both_event.get_primary_hash(), 0.05),
        )

        response = self.client.get(self.path)

        assert response.status_code == 200
        first, *rest = response.data["data"]
        # Seer ranked it second, but it comes first because both types found it
        assert first["issue"]["id"] == str(both_event.group_id)
        assert first["relations"] == [
            {"type": "similar_stacktrace", "score": 0.95},
            {"type": "same_trace"},
        ]
        assert {item["issue"]["id"] for item in rest} == {
            str(similar_event.group_id),
            str(trace_event.group_id),
        }

    @mock.patch(SEER_URLOPEN)
    def test_uses_latest_event(self, mock_seer_request: mock.MagicMock) -> None:
        older_event = self.store_event(
            data={
                **ERROR_EVENT_DATA,
                "fingerprint": ["shared-group"],
                "timestamp": before_now(minutes=5).isoformat(),
            },
            project_id=self.project.id,
        )
        latest_event = self.store_event(
            data={
                "message": "No stack trace here",
                "fingerprint": ["shared-group"],
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert older_event.group_id == latest_event.group_id
        path = (
            f"/api/0/organizations/{self.organization.slug}/issues/{latest_event.group_id}/related/"
        )

        response = self.client.get(path)

        assert response.status_code == 200
        # The older event has a stack trace and TRACE_ID. The latest has no stack trace, and ingest
        # gave it a trace of its own.
        assert response.data == {
            "data": [],
            "meta": {
                "types": [
                    {
                        "type": "similar_stacktrace",
                        "status": "not_applicable",
                        "detail": NO_STACKTRACE_DETAIL,
                        "eventId": latest_event.event_id,
                    },
                    {
                        "type": "same_trace",
                        "status": "ok",
                        "eventId": latest_event.event_id,
                        "traceId": latest_event.trace_id,
                    },
                    {
                        "type": "contributing",
                        "status": "not_applicable",
                        "detail": NOT_A_METRIC_ISSUE_DETAIL,
                    },
                ]
            },
        }
        mock_seer_request.assert_not_called()

    @mock.patch(SEER_URLOPEN)
    def test_issue_without_events(self, mock_seer_request: mock.MagicMock) -> None:
        # Old issues whose events are past retention
        group = self.create_group(project=self.project)

        response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/related/"
        )

        assert response.status_code == 200
        assert response.data["meta"] == {
            "types": [
                {
                    "type": "similar_stacktrace",
                    "status": "not_applicable",
                    "detail": NO_STACKTRACE_DETAIL,
                },
                {
                    "type": "same_trace",
                    "status": "not_applicable",
                    "detail": NO_TRACE_DETAIL,
                },
                {
                    "type": "contributing",
                    "status": "not_applicable",
                    "detail": NOT_A_METRIC_ISSUE_DETAIL,
                },
            ]
        }
        mock_seer_request.assert_not_called()

    @mock.patch(SEER_URLOPEN)
    def test_non_error_issue(self, mock_seer_request: mock.MagicMock) -> None:
        group = self.create_group(project=self.project, type=MetricIssue.type_id)

        response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/related/",
            {"type": "similar_stacktrace"},
        )

        assert response.status_code == 200
        assert response.data["meta"] == {
            "types": [
                {
                    "type": "similar_stacktrace",
                    "status": "not_applicable",
                    "detail": NOT_AN_ERROR_DETAIL,
                }
            ]
        }
        mock_seer_request.assert_not_called()

    @mock.patch(SEER_URLOPEN)
    def test_project_without_seer_similarity(self, mock_seer_request: mock.MagicMock) -> None:
        # Self-hosted, for example
        self.project.delete_option("sentry:similarity_backfill_completed")

        response = self.client.get(self.path, {"type": "similar_stacktrace"})

        assert response.status_code == 200
        assert response.data["meta"] == {
            "types": [
                {
                    "type": "similar_stacktrace",
                    "status": "not_applicable",
                    "detail": SIMILARITY_DISABLED_DETAIL,
                }
            ]
        }
        mock_seer_request.assert_not_called()

    @mock.patch(SEER_URLOPEN)
    def test_seer_error(self, mock_seer_request: mock.MagicMock) -> None:
        mock_seer_request.return_value = HTTPResponse(b"", status=500)

        response = self.client.get(self.path)

        # same_trace still answered, so it's not a 503
        assert response.status_code == 200
        assert response.data == {
            "data": [],
            "meta": {
                "types": [
                    {
                        "type": "similar_stacktrace",
                        "status": "unavailable",
                        "detail": SIMILARITY_UNAVAILABLE_DETAIL,
                        "eventId": self.event.event_id,
                    },
                    {
                        "type": "same_trace",
                        "status": "ok",
                        "eventId": self.event.event_id,
                        "traceId": TRACE_ID,
                    },
                    {
                        "type": "contributing",
                        "status": "not_applicable",
                        "detail": NOT_A_METRIC_ISSUE_DETAIL,
                    },
                ]
            },
        }

    @mock.patch(TRACE_SNUBA_QUERY, side_effect=QueryExecutionError("timeout"))
    @mock.patch(SEER_URLOPEN)
    def test_trace_search_error(
        self, mock_seer_request: mock.MagicMock, mock_snuba_query: mock.MagicMock
    ) -> None:
        mock_seer_request.return_value = seer_response()

        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["meta"] == {
            "types": [
                {"type": "similar_stacktrace", "status": "ok", "eventId": self.event.event_id},
                {
                    "type": "same_trace",
                    "status": "unavailable",
                    "detail": TRACE_SEARCH_UNAVAILABLE_DETAIL,
                    "eventId": self.event.event_id,
                    "traceId": TRACE_ID,
                },
                {
                    "type": "contributing",
                    "status": "not_applicable",
                    "detail": NOT_A_METRIC_ISSUE_DETAIL,
                },
            ]
        }

    def test_contributing(self) -> None:
        metric_event, metric_issue = self.store_metric_issue(
            detector_query(environment="production", event_types=["error"])
        )
        checkout_error = {
            **ERROR_EVENT_DATA,
            "transaction": "/checkout",
            "environment": "production",
            "timestamp": before_now(minutes=4).isoformat(),
        }
        busy_event = self.store_event(
            data={**checkout_error, "fingerprint": ["busy"]}, project_id=self.project.id
        )
        self.store_event(
            data={**checkout_error, "fingerprint": ["busy"]}, project_id=self.project.id
        )
        quiet_event = self.store_event(
            data={**checkout_error, "fingerprint": ["quiet"]}, project_id=self.project.id
        )
        # Each of these misses one part of the detector's query
        self.store_event(
            data={**checkout_error, "fingerprint": ["cart"], "transaction": "/cart"},
            project_id=self.project.id,
        )
        self.store_event(
            data={**checkout_error, "fingerprint": ["staging"], "environment": "staging"},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "message": "A message, not an error",
                "fingerprint": ["message"],
                "transaction": "/checkout",
                "environment": "production",
                "timestamp": before_now(minutes=4).isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                **checkout_error,
                "fingerprint": ["before"],
                "timestamp": before_now(minutes=30).isoformat(),
            },
            project_id=self.project.id,
        )
        assert busy_event.group is not None and quiet_event.group is not None
        open_period = get_latest_open_period(metric_issue)
        assert open_period is not None

        response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/issues/{metric_issue.id}/related/",
            {"type": "contributing"},
        )

        assert response.status_code == 200
        # Most events first
        assert response.data == {
            "data": [
                {
                    "issue": serialize(Group.objects.get(id=busy_event.group.id), self.user),
                    "relations": [{"type": "contributing"}],
                },
                {
                    "issue": serialize(Group.objects.get(id=quiet_event.group.id), self.user),
                    "relations": [{"type": "contributing"}],
                },
            ],
            "meta": {
                "types": [
                    {
                        "type": "contributing",
                        "status": "ok",
                        "eventId": metric_event.event_id,
                        # One detector interval (60s) and a minute before the metric issue opened,
                        # at the start of that minute. No end: the metric issue is still open.
                        "start": (open_period.date_started - timedelta(minutes=2))
                        .replace(second=0, microsecond=0)
                        .isoformat(),
                    }
                ]
            },
        }

    def test_contributing_for_unsupported_detectors(self) -> None:
        spans_event, spans_issue = self.store_metric_issue(
            detector_query(dataset="events_analytics_platform", event_types=["trace_item_span"])
        )
        boolean_event, boolean_issue = self.store_metric_issue(
            detector_query(query="transaction:/checkout OR transaction:/cart")
        )

        response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/issues/{spans_issue.id}/related/",
            {"type": "contributing"},
        )

        assert response.status_code == 200
        assert response.data["meta"] == {
            "types": [
                {
                    "type": "contributing",
                    "status": "not_applicable",
                    "detail": UNSUPPORTED_DATASET_DETAIL,
                    "eventId": spans_event.event_id,
                }
            ]
        }

        response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/issues/{boolean_issue.id}/related/",
            {"type": "contributing"},
        )

        # Issue search doesn't support AND or OR
        assert response.status_code == 200
        assert response.data["meta"] == {
            "types": [
                {
                    "type": "contributing",
                    "status": "not_applicable",
                    "detail": UNSUPPORTED_QUERY_DETAIL,
                    "eventId": boolean_event.event_id,
                }
            ]
        }

    @mock.patch(ISSUE_SEARCH_SNUBA_QUERY, side_effect=QueryExecutionError("timeout"))
    def test_issue_search_error(self, mock_snuba_query: mock.MagicMock) -> None:
        _, metric_issue = self.store_metric_issue(detector_query())

        # setUp's error issue is a candidate for the search, so it reaches Snuba
        response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/issues/{metric_issue.id}/related/",
            {"type": "contributing"},
        )

        # The only requested type failed
        assert response.status_code == 503
        assert response.data == {"detail": ALL_TYPES_UNAVAILABLE_DETAIL}
        mock_snuba_query.assert_called()

    @override_options({"seer.similarity-killswitch.enabled": True})
    @mock.patch(SEER_URLOPEN)
    def test_killswitch(self, mock_seer_request: mock.MagicMock) -> None:
        response = self.client.get(self.path, {"type": "similar_stacktrace"})

        # The only requested type failed
        assert response.status_code == 503
        assert response.data == {"detail": ALL_TYPES_UNAVAILABLE_DETAIL}
        mock_seer_request.assert_not_called()

    @mock.patch(SEER_URLOPEN)
    def test_invalid_params(self, mock_seer_request: mock.MagicMock) -> None:
        response = self.client.get(self.path, {"type": "nope"})
        assert response.status_code == 400
        assert "type" in response.data["detail"]

        response = self.client.get(self.path, {"limit": "101"})
        assert response.status_code == 400
        assert "limit" in response.data["detail"]

        mock_seer_request.assert_not_called()
