from unittest.mock import MagicMock, patch

from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.seer.anomaly_detection.delete_rule import delete_data_in_seer_for_detector
from sentry.seer.anomaly_detection.store_data import SeerMethod
from sentry.seer.anomaly_detection.store_data_workflow_engine import (
    handle_send_historical_data_to_seer,
)
from sentry.testutils.cases import TestCase
from sentry.viewer_context import (
    ActorType,
    ViewerContext,
    get_viewer_context,
    viewer_context_scope,
)


class AnomalyDetectionViewerContextTest(TestCase):
    def _user_context(self) -> ViewerContext:
        return ViewerContext(
            organization_id=self.organization.id,
            user_id=self.user.id,
            actor_type=ActorType.USER,
        )

    @patch("sentry.seer.anomaly_detection.store_data_workflow_engine.send_historical_data_to_seer")
    def test_store_data_preserves_viewer_and_adds_project(self, mock_send: MagicMock) -> None:
        def send(*_args: object, **_kwargs: object) -> None:
            assert get_viewer_context() == ViewerContext(
                organization_id=self.organization.id,
                project_id=self.project.id,
                user_id=self.user.id,
                actor_type=ActorType.USER,
            )

        mock_send.side_effect = send

        with viewer_context_scope(self._user_context()):
            handle_send_historical_data_to_seer(
                detector=MagicMock(),
                data_source=MagicMock(),
                data_condition=MagicMock(),
                snuba_query=MagicMock(event_types=[]),
                project=self.project,
                method=SeerMethod.CREATE,
            )

        assert get_viewer_context() is None

    @patch("sentry.workflow_engine.models.DataSourceDetector.objects.filter")
    @patch("sentry.seer.anomaly_detection.delete_rule.delete_rule_in_seer")
    def test_delete_preserves_viewer_and_adds_project(
        self, mock_delete: MagicMock, mock_filter: MagicMock
    ) -> None:
        data_source_detector = MagicMock()
        data_source_detector.data_source.source_id = "123"
        mock_filter.return_value.first.return_value = data_source_detector

        detector = MagicMock(
            id=1,
            linked_project=self.project,
            config={"detection_type": AlertRuleDetectionType.DYNAMIC},
        )

        def delete(*_args: object, **_kwargs: object) -> bool:
            assert get_viewer_context() == ViewerContext(
                organization_id=self.organization.id,
                project_id=self.project.id,
                user_id=self.user.id,
                actor_type=ActorType.USER,
            )
            return True

        mock_delete.side_effect = delete

        with viewer_context_scope(self._user_context()):
            delete_data_in_seer_for_detector(detector)

        assert get_viewer_context() is None
