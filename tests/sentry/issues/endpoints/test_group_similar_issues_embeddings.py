from collections.abc import Mapping, Sequence
from typing import Any
from unittest import mock

import orjson
from urllib3.response import HTTPResponse

from sentry import options
from sentry.api.serializers.base import serialize
from sentry.conf.server import SEER_SIMILAR_ISSUES_URL
from sentry.issues.endpoints.group_similar_issues_embeddings import (
    GroupSimilarIssuesEmbeddingsEndpoint,
)
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.seer.similarity.types import SeerSimilarIssueData, SimilarIssuesEmbeddingsResponse
from sentry.seer.similarity.utils import MAX_FRAME_COUNT
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.eventprocessing import save_new_event

EXPECTED_STACKTRACE_STRING = 'ZeroDivisionError: division by zero\n  File "python_onboarding.py", function divide_by_zero\n    divide = 1/0'

EVENT_WITH_THREADS_STACKTRACE = {
    "threads": {
        "values": [
            {
                "stacktrace": {
                    "frames": [
                        {
                            "function": "run",
                            "module": "java.lang.Thread",
                            "filename": "Thread.java",
                            "abs_path": "Thread.java",
                            "lineno": 834,
                            "in_app": False,
                        },
                    ]
                }
            }
        ]
    },
}


class GroupSimilarIssuesEmbeddingsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.base_error_trace = {
            "fingerprint": ["my-route", "{{ default }}"],
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
        self.event = self.store_event(data=self.base_error_trace, project_id=self.project)
        self.group = self.event.group
        assert self.group
        self.path = f"/api/0/issues/{self.group.id}/similar-issues-embeddings/"
        self.similar_event = self.store_event(
            data={"message": "Dogs are great!"}, project_id=self.project
        )

    def get_expected_response(
        self,
        group_ids: Sequence[int],
        exception_distances: Sequence[float],
        should_be_grouped: Sequence[str],
    ) -> Sequence[tuple[Any, Mapping[str, Any]]]:
        serialized_groups = serialize(
            list(Group.objects.get_many_from_cache(group_ids)), user=self.user
        )
        response = []
        for i, group in enumerate(serialized_groups):
            response.append(
                (
                    group,
                    {
                        "exception": exception_distances[i],
                        "shouldBeGrouped": should_be_grouped[i],
                    },
                )
            )
        return response

    def test_get_formatted_results(self) -> None:
        event_from_second_similar_group = save_new_event(
            {"message": "Adopt don't shop"}, self.project
        )
        assert self.similar_event.group_id is not None
        similar_issue_data_1 = SeerSimilarIssueData(
            parent_group_id=self.similar_event.group_id,
            parent_hash=self.similar_event.get_primary_hash(),
            should_group=True,
            stacktrace_distance=0.00001,
        )
        assert event_from_second_similar_group.group_id
        similar_issue_data_2 = SeerSimilarIssueData(
            parent_group_id=event_from_second_similar_group.group_id,
            parent_hash=event_from_second_similar_group.get_primary_hash(),
            should_group=False,
            stacktrace_distance=0.23,
        )
        group_similar_endpoint = GroupSimilarIssuesEmbeddingsEndpoint()
        formatted_results = group_similar_endpoint.get_formatted_results(
            similar_issues_data=[similar_issue_data_1, similar_issue_data_2],
            user=self.user,
            group=self.group,
        )
        assert formatted_results == self.get_expected_response(
            [
                self.similar_event.group_id,
                event_from_second_similar_group.group_id,
            ],
            [1.0000, 0.7700],
            ["Yes", "No"],
        )

    @mock.patch("sentry.seer.similarity.similar_issues.metrics.incr")
    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    @mock.patch("sentry.issues.endpoints.group_similar_issues_embeddings.logger")
    def test_simple(
        self,
        mock_logger: mock.MagicMock,
        mock_seer_request: mock.MagicMock,
        mock_metrics_incr: mock.MagicMock,
    ) -> None:
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "parent_hash": self.similar_event.get_primary_hash(),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                }
            ]
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        response = self.client.get(
            self.path,
            data={"k": "1", "threshold": "0.01"},
        )

        assert self.similar_event.group_id is not None
        assert response.data == self.get_expected_response(
            [self.similar_event.group_id], [0.99], ["Yes"]
        )

        expected_seer_request_params = {
            "threshold": 0.01,
            "event_id": self.group.get_latest_event().event_id,
            "hash": self.event.get_primary_hash(),
            "project_id": self.project.id,
            "stacktrace": EXPECTED_STACKTRACE_STRING,
            "exception_type": "ZeroDivisionError",
            "read_only": True,
            "referrer": "similar_issues",
            "use_reranking": True,
            "k": 1,
        }

        mock_seer_request.assert_called_with(
            "POST",
            SEER_SIMILAR_ISSUES_URL,
            body=orjson.dumps(expected_seer_request_params),
            headers={"content-type": "application/json;charset=utf-8"},
        )

        mock_logger.info.assert_called_with(
            "Similar issues embeddings parameters", extra=expected_seer_request_params
        )
        mock_metrics_incr.assert_any_call(
            "seer.similar_issues_request",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={
                "response_status": 200,
                "outcome": "matching_group_found",
                "referrer": "similar_issues",
            },
        )

    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_simple_threads(self, mock_seer_request: mock.MagicMock) -> None:
        event = self.store_event(data=EVENT_WITH_THREADS_STACKTRACE, project_id=self.project)
        data = {
            "parent_hash": self.similar_event.get_primary_hash(),
            "should_group": True,
            "stacktrace_distance": 0.01,
        }
        mock_seer_request.return_value = HTTPResponse(
            orjson.dumps({"responses": [data]}), status=200
        )

        assert event.group
        path = f"/api/0/issues/{event.group.id}/similar-issues-embeddings/"
        response = self.client.get(path, data={"k": "1", "threshold": "0.01"})

        assert self.similar_event.group_id is not None
        assert response.data == self.get_expected_response(
            [self.similar_event.group_id], [0.99], ["Yes"]
        )

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_multiple(self, mock_seer_request: mock.MagicMock, mock_record: mock.MagicMock) -> None:
        over_threshold_group_event = save_new_event({"message": "Maisey is silly"}, self.project)
        under_threshold_group_event = save_new_event({"message": "Charlie is goofy"}, self.project)

        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "parent_hash": self.similar_event.get_primary_hash(),
                    "should_group": True,
                    "stacktrace_distance": 0.002,  # Over threshold
                },
                {
                    "parent_hash": over_threshold_group_event.get_primary_hash(),
                    "should_group": True,
                    "stacktrace_distance": 0.002,  # Over threshold
                },
                {
                    "parent_hash": under_threshold_group_event.get_primary_hash(),
                    "should_group": False,
                    "stacktrace_distance": 0.05,  # Under threshold
                },
            ]
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value))

        response = self.client.get(
            self.path,
            data={"k": "1", "threshold": "0.01"},
        )

        assert self.similar_event.group_id is not None
        assert over_threshold_group_event.group_id is not None
        assert under_threshold_group_event.group_id is not None
        assert response.data == self.get_expected_response(
            [
                self.similar_event.group_id,
                over_threshold_group_event.group_id,
                under_threshold_group_event.group_id,
            ],
            [0.998, 0.998, 0.95],
            ["Yes", "Yes", "No"],
        )

        mock_record.assert_called_with(
            "group_similar_issues_embeddings.count",
            organization_id=self.org.id,
            project_id=self.project.id,
            group_id=self.group.id,
            hash=self.event.get_primary_hash(),
            count_over_threshold=2,
            user_id=self.user.id,
        )

    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_parent_hash_in_group_hashes(self, mock_seer_request: mock.MagicMock) -> None:
        """
        Test that the request group's hashes are filtered out of the returned similar parent hashes
        """
        seer_return_value: Any = {
            "responses": [
                # Make the group's own hash the returned parent hash
                {
                    "parent_hash": self.event.get_primary_hash(),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
                {
                    "parent_hash": self.similar_event.get_primary_hash(),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
            ]
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        response = self.client.get(self.path)

        assert self.similar_event.group_id is not None
        assert response.data == self.get_expected_response(
            [self.similar_event.group_id], [0.99], ["Yes"]
        )

    @mock.patch("sentry.seer.similarity.similar_issues.metrics.incr")
    @mock.patch("sentry.seer.similarity.similar_issues.logger")
    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_incomplete_return_data(
        self,
        mock_seer_request: mock.MagicMock,
        mock_logger: mock.MagicMock,
        mock_metrics_incr: mock.MagicMock,
    ) -> None:
        # Two suggested groups, one with valid data, one missing parent hash. We should log the
        # second and return the first.
        seer_return_value: Any = {
            "responses": [
                {
                    "parent_hash": self.similar_event.get_primary_hash(),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
                {
                    # missing parent hash
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
            ]
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        response = self.client.get(self.path)

        mock_logger.exception.assert_called_with(
            "Seer similar issues response entry missing key 'parent_hash'",
            extra={
                "request_params": {
                    "event_id": self.group.get_latest_event().event_id,
                    "hash": self.event.get_primary_hash(),
                    "project_id": self.project.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "exception_type": "ZeroDivisionError",
                    "read_only": True,
                    "referrer": "similar_issues",
                    "use_reranking": True,
                },
                "raw_similar_issue_data": {
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
            },
        )
        mock_metrics_incr.assert_any_call(
            "seer.similar_issues_request",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={
                "response_status": 200,
                "outcome": "error",
                "error": "IncompleteSeerDataError",
                "referrer": "similar_issues",
            },
        )

        assert self.similar_event.group_id is not None
        assert response.data == self.get_expected_response(
            [self.similar_event.group_id], [0.99], ["Yes"]
        )

    @mock.patch("sentry.seer.similarity.similar_issues.delete_seer_grouping_records_by_hash")
    @mock.patch("sentry.seer.similarity.similar_issues.metrics.incr")
    @mock.patch("sentry.seer.similarity.similar_issues.logger")
    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_nonexistent_grouphash(
        self,
        mock_seer_similarity_request: mock.MagicMock,
        mock_logger: mock.MagicMock,
        mock_metrics_incr: mock.MagicMock,
        mock_seer_deletion_request: mock.MagicMock,
    ) -> None:
        """
        The seer API can return grouphashes that do not exist if their groups have been deleted/merged.
        Test info about these groups is not returned.
        """
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            # Two suggested groups, one with valid data, one pointing to a group that doesn't exist.
            # We should log the second and return the first.
            "responses": [
                {
                    "parent_hash": self.similar_event.get_primary_hash(),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
                {
                    "parent_hash": "not a real hash",
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
            ]
        }
        mock_seer_similarity_request.return_value = HTTPResponse(
            orjson.dumps(seer_return_value), status=200
        )
        response = self.client.get(self.path)

        mock_metrics_incr.assert_any_call(
            "seer.similar_issues_request",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={
                "response_status": 200,
                "outcome": "error",
                "error": "SimilarHashNotFoundError",
                "referrer": "similar_issues",
            },
        )
        assert self.similar_event.group_id
        assert response.data == self.get_expected_response(
            [self.similar_event.group_id], [0.99], ["Yes"]
        )
        mock_logger.warning.assert_called_with(
            "get_similarity_data_from_seer.parent_hash_not_found",
            extra={
                "hash": self.event.get_primary_hash(),
                "parent_hash": "not a real hash",
                "project_id": self.project.id,
                "event_id": self.event.event_id,
            },
        )
        mock_seer_deletion_request.delay.assert_called_with(self.project.id, ["not a real hash"])

    @mock.patch("sentry.seer.similarity.similar_issues.delete_seer_grouping_records_by_hash")
    @mock.patch("sentry.seer.similarity.similar_issues.metrics.incr")
    @mock.patch("sentry.seer.similarity.similar_issues.logger")
    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_grouphash_with_no_group(
        self,
        mock_seer_similarity_request: mock.MagicMock,
        mock_logger: mock.MagicMock,
        mock_metrics_incr: mock.MagicMock,
        mock_seer_deletion_request: mock.MagicMock,
    ) -> None:
        """
        The seer API can return groups that do not exist if they have been deleted/merged.
        Test that these groups are not returned.
        """
        existing_grouphash = GroupHash.objects.create(hash="dogs are great", project=self.project)
        assert existing_grouphash.group_id is None

        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "parent_hash": "dogs are great",
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
            ]
        }
        mock_seer_similarity_request.return_value = HTTPResponse(
            orjson.dumps(seer_return_value), status=200
        )
        response = self.client.get(self.path)

        mock_metrics_incr.assert_any_call(
            "seer.similar_issues_request",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={
                "response_status": 200,
                "outcome": "error",
                "error": "SimilarHashMissingGroupError",
                "referrer": "similar_issues",
            },
        )
        assert response.data == []

        mock_logger.warning.assert_called_with(
            "get_similarity_data_from_seer.parent_hash_missing_group",
            extra={
                "hash": self.event.get_primary_hash(),
                "parent_hash": "dogs are great",
                "project_id": self.project.id,
                "event_id": self.event.event_id,
            },
        )

    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_empty_seer_return(
        self, mock_seer_request: mock.MagicMock, mock_record: mock.MagicMock
    ) -> None:
        mock_seer_request.return_value = HTTPResponse([], status=200)
        response = self.client.get(self.path)
        assert response.data == []

        mock_record.assert_called_with(
            "group_similar_issues_embeddings.count",
            organization_id=self.org.id,
            project_id=self.project.id,
            group_id=self.group.id,
            hash=self.event.get_primary_hash(),
            count_over_threshold=0,
            user_id=self.user.id,
        )

    def test_no_contributing_exception(self) -> None:
        data_no_contributing_exception = {
            "fingerprint": ["message"],
            "message": "Message",
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
                                    "in_app": False,
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
        event_no_contributing_exception = self.store_event(
            data=data_no_contributing_exception, project_id=self.project
        )
        group_no_contributing_exception = event_no_contributing_exception.group
        assert group_no_contributing_exception

        response = self.client.get(
            f"/api/0/issues/{group_no_contributing_exception.id}/similar-issues-embeddings/",
            data={"k": "1", "threshold": "0.98"},
        )

        assert response.data == []

    def test_no_exception(self) -> None:
        event_no_exception = self.store_event(data={}, project_id=self.project)
        group_no_exception = event_no_exception.group
        assert group_no_exception
        response = self.client.get(
            f"/api/0/issues/{group_no_exception.id}/similar-issues-embeddings/",
            data={"k": "1", "threshold": "0.98"},
        )

        assert response.data == []

    @mock.patch("sentry.models.group.Group.get_latest_event")
    def test_no_latest_event(self, mock_get_latest_event: mock.MagicMock) -> None:
        mock_get_latest_event.return_value = None

        response = self.client.get(
            f"/api/0/issues/{self.group.id}/similar-issues-embeddings/",
            data={"k": "1", "threshold": "0.98"},
        )

        assert response.data == []

    @mock.patch("sentry.issues.endpoints.group_similar_issues_embeddings.get_stacktrace_string")
    def test_no_stacktrace_string(self, mock_get_stacktrace_string: mock.MagicMock) -> None:
        mock_get_stacktrace_string.return_value = ""

        response = self.client.get(
            f"/api/0/issues/{self.group.id}/similar-issues-embeddings/",
            data={"k": "1", "threshold": "0.98"},
        )

        assert response.data == []

    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_no_optional_params(self, mock_seer_request: mock.MagicMock) -> None:
        """
        Test that optional parameters, k, threshold, and read_only can not be included.
        """
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "parent_hash": self.similar_event.get_primary_hash(),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                }
            ]
        }

        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value))

        # Include no optional parameters
        response = self.client.get(
            self.path,
            # optional params would be here
        )
        assert self.similar_event.group_id is not None
        assert response.data == self.get_expected_response(
            [self.similar_event.group_id], [0.99], ["Yes"]
        )

        mock_seer_request.assert_called_with(
            "POST",
            SEER_SIMILAR_ISSUES_URL,
            body=orjson.dumps(
                {
                    "threshold": 0.01,
                    "event_id": self.group.get_latest_event().event_id,
                    "hash": self.event.get_primary_hash(),
                    "project_id": self.project.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "exception_type": "ZeroDivisionError",
                    "read_only": True,
                    "referrer": "similar_issues",
                    "use_reranking": True,
                },
            ),
            headers={"content-type": "application/json;charset=utf-8"},
        )

        # Include k
        response = self.client.get(self.path, data={"k": 1})
        assert self.similar_event.group_id is not None
        assert response.data == self.get_expected_response(
            [self.similar_event.group_id], [0.99], ["Yes"]
        )

        mock_seer_request.assert_called_with(
            "POST",
            SEER_SIMILAR_ISSUES_URL,
            body=orjson.dumps(
                {
                    "threshold": 0.01,
                    "event_id": self.group.get_latest_event().event_id,
                    "hash": self.event.get_primary_hash(),
                    "project_id": self.project.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "exception_type": "ZeroDivisionError",
                    "read_only": True,
                    "referrer": "similar_issues",
                    "use_reranking": True,
                    "k": 1,
                },
            ),
            headers={"content-type": "application/json;charset=utf-8"},
        )

        # Include threshold
        response = self.client.get(
            self.path,
            data={"threshold": "0.01"},
        )
        assert response.data == self.get_expected_response(
            [self.similar_event.group_id], [0.99], ["Yes"]
        )

        mock_seer_request.assert_called_with(
            "POST",
            SEER_SIMILAR_ISSUES_URL,
            body=orjson.dumps(
                {
                    "threshold": 0.01,
                    "event_id": self.group.get_latest_event().event_id,
                    "hash": self.event.get_primary_hash(),
                    "project_id": self.project.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "exception_type": "ZeroDivisionError",
                    "read_only": True,
                    "referrer": "similar_issues",
                    "use_reranking": True,
                },
            ),
            headers={"content-type": "application/json;charset=utf-8"},
        )

    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_obeys_useReranking_query_param(self, mock_seer_request: mock.MagicMock) -> None:
        for incoming_value, outgoing_value in [("true", True), ("false", False)]:
            self.client.get(self.path, data={"useReranking": incoming_value})

            assert mock_seer_request.call_count == 1
            request_params = orjson.loads(mock_seer_request.call_args.kwargs["body"])
            assert request_params["use_reranking"] == outgoing_value

            mock_seer_request.reset_mock()

    def test_too_many_frames(self) -> None:
        error_type = "FailedToFetchError"
        error_value = "Charlie didn't bring the ball back"
        context_line = f"raise {error_type}('{error_value}')"
        error_data = {
            "exception": {
                "values": [
                    {
                        "type": error_type,
                        "value": error_value,
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": f"play_fetch_{i}",
                                    "filename": f"dogpark{i}.py",
                                    "context_line": context_line,
                                }
                                for i in range(MAX_FRAME_COUNT + 1)
                            ]
                        },
                    }
                ]
            },
            "platform": "java",
        }
        new_event = self.store_event(data=error_data, project_id=self.project)
        assert new_event.group
        response = self.client.get(
            path=f"/api/0/issues/{new_event.group.id}/similar-issues-embeddings/",
            data={"k": "1", "threshold": "0.01"},
        )
        assert response.data == []

    def test_no_filename_or_module(self) -> None:
        error_type = "FailedToFetchError"
        error_value = "Charlie didn't bring the ball back"
        context_line = f"raise {error_type}('{error_value}')"
        error_data = {
            "exception": {
                "values": [
                    {
                        "type": error_type,
                        "value": error_value,
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": f"play_fetch_{i}",
                                    "context_line": context_line,
                                }
                                for i in range(MAX_FRAME_COUNT + 1)
                            ]
                        },
                    }
                ]
            },
            "platform": "python",
        }
        new_event = self.store_event(data=error_data, project_id=self.project)
        assert new_event.group
        response = self.client.get(
            path=f"/api/0/issues/{new_event.group.id}/similar-issues-embeddings/",
            data={"k": "1", "threshold": "0.01"},
        )
        assert response.data == []
