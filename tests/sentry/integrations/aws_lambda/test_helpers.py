from __future__ import absolute_import

from sentry.testutils.helpers.faux import Mock
from sentry.utils.compat.mock import MagicMock


def gen_list_functions_mock(functions):
    mock_client = Mock()
    mock_client.list_functions = MagicMock(return_value={"Functions": functions})
    return mock_client
