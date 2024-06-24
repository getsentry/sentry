from typing import Any
from unittest import mock
from unittest.mock import MagicMock

from urllib3.response import HTTPResponse

from sentry.conf.server import SEER_SIMILAR_ISSUES_URL
from sentry.seer.similarity.similar_issues import get_similarity_data_from_seer
from sentry.seer.similarity.types import (
    RawSeerSimilarIssueData,
    SeerSimilarIssueData,
    SimilarIssuesEmbeddingsRequest,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.utils import json
from sentry.utils.types import NonNone


class GetSimilarityDataFromSeerTest(TestCase):
    def setUp(self):
        self.similar_event = save_new_event({"message": "Dogs are great!"}, self.project)
        self.similar_event_hash = NonNone(self.similar_event.get_primary_hash())
        self.request_params: SimilarIssuesEmbeddingsRequest = {
            "hash": "11212012123120120415201309082013",
            "project_id": self.project.id,
            "stacktrace": "<stringified stacktrace>",
            "message": "Charlie didn't bring the ball back",
            "exception_type": "FailedToFetchError",
        }

    def _make_response(self, data: dict[str, Any], status: int = 200):
        return HTTPResponse(json.dumps(data).encode("utf-8"), status=status)

    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_groups_found(self, mock_seer_request: MagicMock):
        cases: list[tuple[RawSeerSimilarIssueData]] = [
            (
                {
                    "message_distance": 0.05,
                    "parent_hash": self.similar_event_hash,
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
            ),
            (
                {
                    "message_distance": 0.08,
                    "parent_hash": self.similar_event_hash,
                    "should_group": False,
                    "stacktrace_distance": 0.05,
                },
            ),
        ]

        for (raw_data,) in cases:
            mock_seer_request.return_value = self._make_response({"responses": [raw_data]})

            similar_issue_data: Any = {
                **raw_data,
                "parent_group_id": self.similar_event.group_id,
            }

            assert get_similarity_data_from_seer(self.request_params) == [
                SeerSimilarIssueData(**similar_issue_data)
            ]

    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_empty_similar_issues_embeddings(self, mock_seer_request: MagicMock):
        mock_seer_request.return_value = HTTPResponse([])

        assert get_similarity_data_from_seer(self.request_params) == []

    @mock.patch("sentry.seer.similarity.similar_issues.logger")
    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_redirect(self, mock_seer_request: MagicMock, mock_logger: MagicMock):
        mock_seer_request.return_value = HTTPResponse(
            status=308, headers={"location": "/new/and/improved/endpoint/"}
        )

        assert get_similarity_data_from_seer(self.request_params) == []
        mock_logger.error.assert_called_with(
            f"Encountered redirect when calling Seer endpoint {SEER_SIMILAR_ISSUES_URL}. Please update `SEER_SIMILAR_ISSUES_URL` in `sentry.conf.server` to be '/new/and/improved/endpoint/'."
        )

    @mock.patch("sentry.seer.similarity.similar_issues.logger")
    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_error_status(self, mock_seer_request: MagicMock, mock_logger: MagicMock):
        mock_seer_request.return_value = HTTPResponse("No soup for you", status=403)

        assert get_similarity_data_from_seer(self.request_params) == []
        mock_logger.error.assert_called_with(
            f"Received 403 when calling Seer endpoint {SEER_SIMILAR_ISSUES_URL}.",
            extra={"response_data": "No soup for you"},
        )

    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_returns_sorted_similarity_results(self, mock_seer_request: MagicMock):
        less_similar_event = save_new_event({"message": "Charlie is goofy"}, self.project)

        raw_similar_issue_data: RawSeerSimilarIssueData = {
            "message_distance": 0.05,
            "parent_hash": self.similar_event_hash,
            "should_group": True,
            "stacktrace_distance": 0.01,
        }
        raw_less_similar_issue_data: RawSeerSimilarIssueData = {
            "message_distance": 0.10,
            "parent_hash": NonNone(less_similar_event.get_primary_hash()),
            "should_group": False,
            "stacktrace_distance": 0.05,
        }

        # Note that the less similar issue is first in the list as it comes back from Seer
        mock_seer_request.return_value = self._make_response(
            {"responses": [raw_less_similar_issue_data, raw_similar_issue_data]}
        )

        similar_issue_data: Any = {
            **raw_similar_issue_data,
            "parent_group_id": self.similar_event.group_id,
        }
        less_similar_issue_data: Any = {
            **raw_less_similar_issue_data,
            "parent_group_id": less_similar_event.group_id,
        }

        # The results have been reordered so that the more similar issue comes first
        assert get_similarity_data_from_seer(self.request_params) == [
            SeerSimilarIssueData(**similar_issue_data),
            SeerSimilarIssueData(**less_similar_issue_data),
        ]
