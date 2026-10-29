from unittest.mock import Mock, patch

from django.http import JsonResponse

from sentry.api.client import ApiClient
from sentry.testutils.cases import TestCase
from sentry.viewer_context import (
    Actor,
    ActorType,
    ViewerContext,
    get_viewer_context,
    viewer_context_scope,
)


class ClientParameterHandlingTest(TestCase):
    @patch("sentry.api.client.resolve")
    def test_mixed_parameters_in_query_string(self, mock_resolve):
        mock_view = Mock(return_value=JsonResponse({"success": True}))
        mock_resolve.return_value = (mock_view, (), {})

        mock_auth = Mock()
        mock_auth.organization_id = 1
        mock_auth.scope_list = ["org:read"]

        params = {
            "project": [1, 2, 3],
            "query": "test",
            "yAxis": ["count()", "p95()"],
            "statsPeriod": "14d",
            "tags": [],
        }

        client = ApiClient()
        response = client.get(auth=mock_auth, user=None, path="/test/", params=params)

        assert response.status_code == 200

        mock_view.assert_called_once()
        request = mock_view.call_args[0][0]

        expected_queries = {
            "project": ["1", "2", "3"],  # numeric values converted to strings; list preserved
            "query": ["test"],
            "yAxis": ["count()", "p95()"],  # list preserved
            "statsPeriod": ["14d"],
            "tags": [],  # empty list preserved
        }
        actual_queries = dict(request.GET.lists())

        assert actual_queries == expected_queries


class ClientViewerContextTest(TestCase):
    @patch("sentry.api.client.resolve")
    def test_view_caller_does_not_leak(self, mock_resolve):
        mock_view = Mock(return_value=JsonResponse({}))
        mock_resolve.return_value = (mock_view, (), {})
        outer = ViewerContext(actor=Actor(type=ActorType.UNKNOWN))
        other = self.create_user()

        with viewer_context_scope(outer):
            ApiClient().get(user=other, path="/test/")
            assert get_viewer_context() == outer
