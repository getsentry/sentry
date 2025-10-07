from unittest.mock import MagicMock, Mock, patch

from django.http import JsonResponse

from sentry.api.client import ApiClient
from sentry.testutils.cases import TestCase


class ClientParameterHandlingTest(TestCase):
    @patch("sentry.api.client.resolve")
    @patch("sentry.api.client.APIRequestFactory")
    @patch("sentry.api.client.force_authenticate")
    def test_list_parameters_use_setlist(self, mock_force_auth, mock_factory_class, mock_resolve):
        """Test that list parameters are properly converted using setlist()"""
        mock_request = Mock()
        mock_request.GET = MagicMock()
        mock_request.GET._mutable = True
        mock_request.META = {}
        mock_factory = Mock()
        mock_factory.get.return_value = mock_request
        mock_factory_class.return_value = mock_factory
        mock_view = Mock(return_value=JsonResponse({"success": True}))
        mock_resolve.return_value = (mock_view, (), {})
        mock_auth = Mock()
        mock_auth.organization_id = 1
        mock_auth.scope_list = ["org:read"]

        params = {"project": [1, 2, 3], "field": ["id", "timestamp"]}

        client = ApiClient()
        client.get(auth=mock_auth, user=None, path="/test/", params=params)

        # verify setlist was called for list parameters
        assert mock_request.GET.setlist.call_count == 2
        mock_request.GET.setlist.assert_any_call("project", ["1", "2", "3"])
        mock_request.GET.setlist.assert_any_call("field", ["id", "timestamp"])

    @patch("sentry.api.client.resolve")
    @patch("sentry.api.client.APIRequestFactory")
    @patch("sentry.api.client.force_authenticate")
    def test_non_list_parameters_set_directly(
        self, mock_force_auth, mock_factory_class, mock_resolve
    ):
        """Test that non-list parameters are set as single values"""
        mock_request = Mock()
        mock_request.GET = MagicMock()
        mock_request.GET._mutable = True
        mock_request.META = {}
        mock_factory = Mock()
        mock_factory.get.return_value = mock_request
        mock_factory_class.return_value = mock_factory

        mock_view = Mock(return_value=JsonResponse({"success": True}))
        mock_resolve.return_value = (mock_view, (), {})

        mock_auth = Mock()
        mock_auth.organization_id = 1
        mock_auth.scope_list = ["org:read"]

        params = {"query": "test", "statsPeriod": "14d", "limit": 100}

        client = ApiClient()
        client.get(auth=mock_auth, user=None, path="/test/", params=params)

        # verify __setitem__ was called for non-list parameters (values converted to strings)
        assert mock_request.GET.__setitem__.call_count == 3
        mock_request.GET.__setitem__.assert_any_call("query", "test")
        mock_request.GET.__setitem__.assert_any_call("statsPeriod", "14d")
        mock_request.GET.__setitem__.assert_any_call("limit", "100")

    @patch("sentry.api.client.resolve")
    @patch("sentry.api.client.APIRequestFactory")
    @patch("sentry.api.client.force_authenticate")
    def test_mixed_list_and_non_list_parameters(
        self, mock_force_auth, mock_factory_class, mock_resolve
    ):
        """Test that mixed list and non-list parameters work together"""
        mock_request = Mock()
        mock_request.GET = MagicMock()
        mock_request.GET._mutable = True
        mock_request.META = {}
        mock_factory = Mock()
        mock_factory.get.return_value = mock_request
        mock_factory_class.return_value = mock_factory

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
        }

        client = ApiClient()
        client.get(auth=mock_auth, user=None, path="/test/", params=params)

        # verify setlist was called for list parameters
        assert mock_request.GET.setlist.call_count == 2
        mock_request.GET.setlist.assert_any_call("project", ["1", "2", "3"])
        mock_request.GET.setlist.assert_any_call("yAxis", ["count()", "p95()"])

        # verify __setitem__ was called for non-list parameters
        assert mock_request.GET.__setitem__.call_count == 2
        mock_request.GET.__setitem__.assert_any_call("query", "test")
        mock_request.GET.__setitem__.assert_any_call("statsPeriod", "14d")

    @patch("sentry.api.client.resolve")
    @patch("sentry.api.client.APIRequestFactory")
    @patch("sentry.api.client.force_authenticate")
    def test_empty_list_parameters(self, mock_force_auth, mock_factory_class, mock_resolve):
        """Test that empty lists are handled correctly"""
        mock_request = Mock()
        mock_request.GET = MagicMock()
        mock_request.GET._mutable = True
        mock_request.META = {}
        mock_factory = Mock()
        mock_factory.get.return_value = mock_request
        mock_factory_class.return_value = mock_factory

        mock_view = Mock(return_value=JsonResponse({"success": True}))
        mock_resolve.return_value = (mock_view, (), {})

        mock_auth = Mock()
        mock_auth.organization_id = 1
        mock_auth.scope_list = ["org:read"]

        params = {"project": [], "query": "test"}

        client = ApiClient()
        client.get(auth=mock_auth, user=None, path="/test/", params=params)

        # verify setlist was called with empty list
        mock_request.GET.setlist.assert_called_once_with("project", [])
        mock_request.GET.__setitem__.assert_called_once_with("query", "test")

    @patch("sentry.api.client.resolve")
    @patch("sentry.api.client.APIRequestFactory")
    @patch("sentry.api.client.force_authenticate")
    def test_numeric_values_converted_to_strings(
        self, mock_force_auth, mock_factory_class, mock_resolve
    ):
        """Test that all values (including numbers) are converted to strings"""
        mock_request = Mock()
        mock_request.GET = MagicMock()
        mock_request.GET._mutable = True
        mock_request.META = {}
        mock_factory = Mock()
        mock_factory.get.return_value = mock_request
        mock_factory_class.return_value = mock_factory

        mock_view = Mock(return_value=JsonResponse({"success": True}))
        mock_resolve.return_value = (mock_view, (), {})

        mock_auth = Mock()
        mock_auth.organization_id = 1
        mock_auth.scope_list = ["org:read"]

        params = {"project": [1, 2, 3], "limit": 100, "offset": 0}

        client = ApiClient()
        client.get(auth=mock_auth, user=None, path="/test/", params=params)

        # verify numeric values in lists are converted to strings
        mock_request.GET.setlist.assert_called_once_with("project", ["1", "2", "3"])

        # verify numeric scalar values are converted to strings
        mock_request.GET.__setitem__.assert_any_call("limit", "100")
        mock_request.GET.__setitem__.assert_any_call("offset", "0")
