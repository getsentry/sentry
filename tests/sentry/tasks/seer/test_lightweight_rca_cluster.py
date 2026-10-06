from unittest.mock import MagicMock, patch

from sentry.tasks.seer.lightweight_rca_cluster import trigger_lightweight_rca_cluster_task
from sentry.testutils.cases import TestCase
from sentry.viewer_context import ActorType, ViewerContext, get_viewer_context, viewer_context_scope


class TriggerLightweightRCAClusterTaskTest(TestCase):
    @patch("sentry.tasks.seer.lightweight_rca_cluster.trigger_lightweight_rca_cluster")
    def test_preserves_viewer_and_adds_project(self, mock_trigger: MagicMock) -> None:
        group = self.create_group(project=self.project)

        def trigger(*_args: object, **_kwargs: object) -> None:
            assert get_viewer_context() == ViewerContext(
                organization_id=self.organization.id,
                project_id=self.project.id,
                user_id=self.user.id,
                actor_type=ActorType.USER,
            )

        mock_trigger.side_effect = trigger

        with viewer_context_scope(
            ViewerContext(
                organization_id=self.organization.id,
                user_id=self.user.id,
                actor_type=ActorType.USER,
            )
        ):
            trigger_lightweight_rca_cluster_task(group.id)

        mock_trigger.assert_called_once_with(group)
        assert get_viewer_context() is None
