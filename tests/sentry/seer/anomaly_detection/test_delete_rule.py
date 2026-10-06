from typing import Any
from unittest.mock import MagicMock, Mock, patch

from urllib3.response import HTTPResponse

from sentry.seer.anomaly_detection.delete_rule import delete_rule_in_seer
from sentry.testutils.cases import TestCase
from sentry.viewer_context import ActorType, ViewerContext, get_viewer_context


class DeleteRuleInSeerTest(TestCase):
    @patch("sentry.seer.anomaly_detection.delete_rule.make_delete_alert_data_request")
    def test_establishes_project_viewer_context(self, mock_request: MagicMock) -> None:
        def make_request(*args: Any, **kwargs: Any) -> Mock:
            assert get_viewer_context() == ViewerContext(
                organization_id=self.organization.id,
                project_id=self.project.id,
                actor_type=ActorType.SYSTEM,
            )
            response = Mock(spec=HTTPResponse)
            response.status = 200
            response.data = b'{"success": true}'
            return response

        mock_request.side_effect = make_request

        assert delete_rule_in_seer(
            source_id=1,
            organization=self.organization,
            project_id=self.project.id,
        )
        assert get_viewer_context() is None
