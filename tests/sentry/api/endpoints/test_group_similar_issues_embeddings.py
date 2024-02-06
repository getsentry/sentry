from collections.abc import Mapping, Sequence
from typing import Any
from unittest import mock

from urllib3.response import HTTPResponse

from sentry.api.endpoints.group_similar_issues_embeddings import (
    GroupSimilarIssuesEmbeddingsEndpoint,
    get_stacktrace_string,
)
from sentry.api.serializers.base import serialize
from sentry.models.group import Group
from sentry.seer.utils import SimilarIssuesEmbeddingsData, SimilarIssuesEmbeddingsResponse
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

EXPECTED_STACKTRACE_STRING = 'ZeroDivisionError: division by zero\n  File "python_onboarding.py", line 20, in divide_by_zero_another\n    divide_by_zero_another()'


@region_silo_test
class GroupSimilarIssuesEmbeddingsTest(APITestCase):
    def setUp(self):
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
                                    "function": "divide_by_zero_another",
                                    "module": "__main__",
                                    "filename": "python_onboarding.py",
                                    "abs_path": "/Users/jodi/python_onboarding/python_onboarding.py",
                                    "lineno": 20,
                                    "context_line": " divide_by_zero_another()",
                                }
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
        self.similar_group = self.create_group(project=self.project)

    def get_expected_response(
        self,
        group_ids: Sequence[int],
        message_similarities: Sequence[float],
        exception_similarities: Sequence[float],
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
                        "message": message_similarities[i],
                        "exception": exception_similarities[i],
                        "shouldBeGrouped": should_be_grouped[i],
                    },
                )
            )
        return response

    def test_get_stacktrace_string(self):
        stacktrace_string = get_stacktrace_string(self.base_error_trace["exception"], self.event)  # type: ignore
        assert stacktrace_string == EXPECTED_STACKTRACE_STRING

    def test_get_stacktrace_string_no_values(self):
        stacktrace_string = get_stacktrace_string({"values": []}, self.event)
        assert stacktrace_string == ""

    def test_get_formatted_results(self):
        new_group = self.create_group(project=self.project)
        response_1: SimilarIssuesEmbeddingsData = {
            "message_similarity": 0.95,
            "parent_group_id": self.similar_group.id,
            "should_group": True,
            "stacktrace_similarity": 0.99,
        }
        response_2: SimilarIssuesEmbeddingsData = {
            "message_similarity": 0.51,
            "parent_group_id": new_group.id,
            "should_group": False,
            "stacktrace_similarity": 0.23,
        }
        group_similar_endpoint = GroupSimilarIssuesEmbeddingsEndpoint()
        formatted_results = group_similar_endpoint.get_formatted_results(
            responses=[response_1, response_2], user=self.user
        )
        assert formatted_results == self.get_expected_response(
            [self.similar_group.id, new_group.id], [0.95, 0.51], [0.99, 0.23], ["Yes", "No"]
        )

    def test_no_feature_flag(self):
        response = self.client.get(self.path)

        assert response.status_code == 404, response.content

    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.seer.utils.seer_connection_pool.urlopen")
    def test_simple(self, mock_seer_request):
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "message_similarity": 0.95,
                    "parent_group_id": self.similar_group.id,
                    "should_group": True,
                    "stacktrace_similarity": 0.99,
                }
            ]
        }
        mock_seer_request.return_value = HTTPResponse(json.dumps(seer_return_value).encode("utf-8"))

        response = self.client.get(
            self.path,
            data={"k": "1", "threshold": "0.98"},
        )

        assert response.data == self.get_expected_response(
            [self.similar_group.id], [0.95], [0.99], ["Yes"]
        )

        mock_seer_request.assert_called_with(
            "POST",
            "/v0/issues/similar-issues",
            body=json.dumps(
                {
                    "group_id": self.group.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "message": self.group.message,
                    "k": 1,
                    "threshold": 0.98,
                },
            ),
            headers={"Content-Type": "application/json;charset=utf-8"},
        )

    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.seer.utils.seer_connection_pool.urlopen")
    def test_invalid_return(self, mock_seer_request):
        """
        The seer API can return groups that do not exist if they have been deleted/merged.
        Test that these groups are not returned.
        """
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "message_similarity": 0.95,
                    "parent_group_id": self.similar_group.id,
                    "should_group": True,
                    "stacktrace_similarity": 0.99,
                },
                {
                    "message_similarity": 0.95,
                    "parent_group_id": 10000000,  # An arbitrarily large group ID that will not exist
                    "should_group": True,
                    "stacktrace_similarity": 0.99,
                },
            ]
        }
        mock_seer_request.return_value = HTTPResponse(json.dumps(seer_return_value).encode("utf-8"))
        response = self.client.get(self.path)
        assert response.data == self.get_expected_response(
            [self.similar_group.id], [0.95], [0.99], ["Yes"]
        )

    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.seer.utils.seer_connection_pool.urlopen")
    def test_empty_return(self, mock_seer_request):
        mock_seer_request.return_value = HTTPResponse([])
        response = self.client.get(self.path)
        assert response.data == []

    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.seer.utils.seer_connection_pool.urlopen")
    def test_no_optional_params(self, mock_seer_request):
        """
        Test that optional parameters, k and threshold, can not be included.
        """
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "message_similarity": 0.95,
                    "parent_group_id": self.similar_group.id,
                    "should_group": True,
                    "stacktrace_similarity": 0.99,
                }
            ]
        }

        mock_seer_request.return_value = HTTPResponse(json.dumps(seer_return_value).encode("utf-8"))

        # Include no optional parameters
        response = self.client.get(self.path)
        assert response.data == self.get_expected_response(
            [self.similar_group.id], [0.95], [0.99], ["Yes"]
        )

        mock_seer_request.assert_called_with(
            "POST",
            "/v0/issues/similar-issues",
            body=json.dumps(
                {
                    "group_id": self.group.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "message": self.group.message,
                },
            ),
            headers={"Content-Type": "application/json;charset=utf-8"},
        )

        # Include k
        response = self.client.get(
            self.path,
            data={"k": 1},
        )
        assert response.data == self.get_expected_response(
            [self.similar_group.id], [0.95], [0.99], ["Yes"]
        )

        mock_seer_request.assert_called_with(
            "POST",
            "/v0/issues/similar-issues",
            body=json.dumps(
                {
                    "group_id": self.group.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "message": self.group.message,
                    "k": 1,
                },
            ),
            headers={"Content-Type": "application/json;charset=utf-8"},
        )

        # Include threshold
        response = self.client.get(
            self.path,
            data={"threshold": "0.98"},
        )
        assert response.data == self.get_expected_response(
            [self.similar_group.id], [0.95], [0.99], ["Yes"]
        )

        mock_seer_request.assert_called_with(
            "POST",
            "/v0/issues/similar-issues",
            body=json.dumps(
                {
                    "group_id": self.group.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "message": self.group.message,
                    "threshold": 0.98,
                },
            ),
            headers={"Content-Type": "application/json;charset=utf-8"},
        )
