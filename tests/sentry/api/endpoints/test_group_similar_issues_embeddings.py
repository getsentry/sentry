from unittest import mock

from sentry.api.endpoints.group_similar_issues_embeddings import get_stacktrace_string
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test

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

    def test_get_stacktrace_string(self):
        stacktrace_string = get_stacktrace_string(self.base_error_trace["exception"], self.event)  # type: ignore
        assert stacktrace_string == EXPECTED_STACKTRACE_STRING

    def test_no_feature_flag(self):
        response = self.client.post(self.path)

        assert response.status_code == 404, response.content

    @with_feature("organizations:issues-similarity-embeddings")
    @mock.patch(
        "sentry.api.endpoints.group_similar_issues_embeddings.get_similar_issues_embeddings"
    )
    def test_simple(self, mock_get_similar_issues_embeddings):
        similar_data = {
            "responses": [
                {
                    "message_similarity": 0.95,
                    "parent_group_id": 6,
                    "should_group": True,
                    "stacktrace_similarity": 0.99,
                }
            ]
        }
        mock_get_similar_issues_embeddings.return_value = similar_data
        response = self.client.post(
            self.path,
            data={
                "query": {"k": 1, "threshold": 0.98},
            },
        )
        assert response.data == similar_data
        mock_get_similar_issues_embeddings.assert_called_with(
            {
                "group_id": self.group.id,
                "stacktrace": EXPECTED_STACKTRACE_STRING,
                "message": self.group.message,
                "k": 1,
                "threshold": 0.98,
            }
        )

    @with_feature("organizations:issues-similarity-embeddings")
    @mock.patch(
        "sentry.api.endpoints.group_similar_issues_embeddings.get_similar_issues_embeddings"
    )
    def test_no_optional_params(self, mock_get_similar_issues_embeddings):
        """
        Test that optional parameters, k and threshold, can not be included.
        """
        similar_data = {
            "responses": [
                {
                    "message_similarity": 0.95,
                    "parent_group_id": 6,
                    "should_group": True,
                    "stacktrace_similarity": 0.99,
                }
            ]
        }
        mock_get_similar_issues_embeddings.return_value = similar_data

        # Include no optional parameters
        response = self.client.post(self.path)

        assert response.data == similar_data
        mock_get_similar_issues_embeddings.assert_called_with(
            {
                "group_id": self.group.id,
                "stacktrace": EXPECTED_STACKTRACE_STRING,
                "message": self.group.message,
            }
        )

        # Include k
        response = self.client.post(
            self.path,
            data={
                "query": {"k": 1},
            },
        )
        assert response.data == similar_data
        mock_get_similar_issues_embeddings.assert_called_with(
            {
                "group_id": self.group.id,
                "stacktrace": EXPECTED_STACKTRACE_STRING,
                "message": self.group.message,
                "k": 1,
            }
        )

        # Include threshold
        response = self.client.post(
            self.path,
            data={
                "query": {"threshold": 0.98},
            },
        )
        assert response.data == similar_data
        mock_get_similar_issues_embeddings.assert_called_with(
            {
                "group_id": self.group.id,
                "stacktrace": EXPECTED_STACKTRACE_STRING,
                "message": self.group.message,
                "threshold": 0.98,
            }
        )

    @with_feature("organizations:issues-similarity-embeddings")
    @mock.patch(
        "sentry.api.endpoints.group_similar_issues_embeddings.get_similar_issues_embeddings"
    )
    @mock.patch("sentry.api.endpoints.group_similar_issues_embeddings.logger.exception")
    def test_exception(self, mock_logger, mock_get_similar_issues_embeddings):
        """Test that when there is an exception, the logger is called."""
        mock_get_similar_issues_embeddings.side_effect = Exception()
        self.client.post(self.path)
        mock_logger.assert_called_with("Failed to get similar issues embeddings.")
