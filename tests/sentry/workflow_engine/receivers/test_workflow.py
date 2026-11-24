from unittest.mock import MagicMock, patch

import pytest
from django.db import router, transaction
from jsonschema import ValidationError

from sentry.constants import ObjectStatus
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.caches.workflow import get_activity_workflows_by_organization
from sentry.workflow_engine.models import Workflow


class WorkflowConfigValidationTests(TestCase):
    def test_alert_rejects_inbox_default_key(self) -> None:
        with pytest.raises(ValidationError, match="default_key"):
            self.create_workflow(
                type=Workflow.Type.ALERT, config={"default_key": Workflow.INBOX_DEFAULT_KEY}
            )

    def test_inbox_rejects_unknown_default_key(self) -> None:
        with pytest.raises(ValidationError, match=Workflow.INBOX_DEFAULT_KEY):
            self.create_workflow(type=Workflow.Type.INBOX, config={"default_key": "unknown"})


class WorkflowReceiverTests(TestCase):
    def setUp(self) -> None:
        self.environment = self.create_environment()
        self.workflow = self.create_workflow(environment=self.environment)
        self.detector = self.create_detector()
        self.create_detector_workflow(detector=self.detector, workflow=self.workflow)

    @patch("sentry.workflow_engine.receivers.workflow.invalidate_processing_workflows")
    def test_cache_invalidate__new_workflow(self, mock_invalidate: MagicMock) -> None:
        new_workflow = self.create_workflow()

        # since this is a new workflow, nothing to invalidate
        mock_invalidate.assert_not_called()
        assert new_workflow

    @patch("sentry.workflow_engine.receivers.workflow.invalidate_processing_workflows")
    def test_cache_invalidate__update_workflow(self, mock_invalidate: MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.enabled = False
            self.workflow.save()

        mock_invalidate.assert_called_with(self.detector.id, self.workflow.environment_id)
        assert self.workflow.enabled is False

    @patch("sentry.workflow_engine.receivers.workflow.invalidate_processing_workflows")
    def test_cache_invalidate__delete_workflow(self, mock_invalidate: MagicMock) -> None:
        env_id = self.workflow.environment_id
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.delete()
        mock_invalidate.assert_called_with(self.detector.id, env_id)

    @patch("sentry.workflow_engine.receivers.workflow.invalidate_processing_workflows")
    def test_cache_invalidate__delete_with_many_detectors(self, mock_invalidate: MagicMock) -> None:
        detector = self.create_detector()
        self.create_detector_workflow(detector=detector, workflow=self.workflow)
        env_id = self.workflow.environment_id

        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.delete()

        # Make sure it was called for each detector
        assert mock_invalidate.call_count == 2
        mock_invalidate.assert_any_call(self.detector.id, env_id)
        mock_invalidate.assert_any_call(detector.id, env_id)


class ActivityWorkflowCacheInvalidationTest(TestCase):
    def setUp(self) -> None:
        self.workflow = self.create_workflow(type=Workflow.Type.INBOX)
        assert get_activity_workflows_by_organization(self.organization.id, None) == {self.workflow}

    def test_creation_invalidates_empty_cache_after_commit(self) -> None:
        other_org = self.create_organization()
        assert get_activity_workflows_by_organization(other_org.id, None) == set()
        with self.capture_on_commit_callbacks(execute=True):
            with transaction.atomic(router.db_for_write(Workflow)):
                workflow = self.create_workflow(organization=other_org, type=Workflow.Type.INBOX)
                assert get_activity_workflows_by_organization(other_org.id, None) == set()

        assert get_activity_workflows_by_organization(other_org.id, None) == {workflow}
        with self.assertNumQueries(0):
            assert get_activity_workflows_by_organization(self.organization.id, None) == {
                self.workflow
            }

    def test_disable_and_reenable(self) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.enabled = False
            self.workflow.save()
        assert get_activity_workflows_by_organization(self.organization.id, None) == set()
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.update(enabled=True)
        assert get_activity_workflows_by_organization(self.organization.id, None) == {self.workflow}

    def test_type_change_in_both_directions(self) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.update(type=Workflow.Type.ALERT)
        assert get_activity_workflows_by_organization(self.organization.id, None) == set()
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.update(type=Workflow.Type.INBOX)
        assert get_activity_workflows_by_organization(self.organization.id, None) == {self.workflow}

    def test_changed_configuration_is_reloaded(self) -> None:
        condition_group = self.create_data_condition_group()
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.update(config={"frequency": 0}, when_condition_group=condition_group)
        (workflow,) = get_activity_workflows_by_organization(self.organization.id, None)
        assert workflow.config == {"frequency": 0}
        assert workflow.when_condition_group_id == condition_group.id

    def test_environment_change_invalidates_all_environment_views(self) -> None:
        environment = self.create_environment()
        other_environment = self.create_environment(name="other")
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.update(environment=environment)
        assert get_activity_workflows_by_organization(self.organization.id, environment) == {
            self.workflow
        }
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.update(environment=other_environment)
        assert get_activity_workflows_by_organization(self.organization.id, environment) == set()
        assert get_activity_workflows_by_organization(self.organization.id, other_environment) == {
            self.workflow
        }

    def test_pending_deletion(self) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.update(status=ObjectStatus.PENDING_DELETION)
        assert get_activity_workflows_by_organization(self.organization.id, None) == set()

    def test_delete(self) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.delete()
        assert get_activity_workflows_by_organization(self.organization.id, None) == set()

    def test_rollback_preserves_cache(self) -> None:
        with self.capture_on_commit_callbacks(execute=True) as callbacks:
            with pytest.raises(RuntimeError), transaction.atomic(router.db_for_write(Workflow)):
                self.workflow.update(enabled=False)
                raise RuntimeError("roll back workflow change")
        assert callbacks == []
        with self.assertNumQueries(0):
            (workflow,) = get_activity_workflows_by_organization(self.organization.id, None)
        assert workflow.enabled
