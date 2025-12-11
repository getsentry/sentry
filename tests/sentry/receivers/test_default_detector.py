from unittest import mock

import pytest
from django.db.models.signals import post_save

from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.models.project import Project
from sentry.receivers.project_detectors import (
    create_metric_detector_with_owner,
    disable_default_detector_creation,
)
from sentry.signals import project_created
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models import DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.processors.detector import _ensure_metric_detector
from sentry.workflow_engine.types import DetectorPriorityLevel
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


class TestEnsureMetricDetector(TestCase):
    def test_creates_detector_with_all_components(self):
        """Test that _ensure_metric_detector creates detector with all required components."""
        project = self.create_project()
        team = self.create_team(organization=project.organization)
        project.add_team(team)

        with mock.patch(
            "sentry.workflow_engine.processors.detector.send_new_detector_data"
        ) as mock_send:
            detector = _ensure_metric_detector(project, owner_team_id=team.id, enabled=False)
            assert detector is not None
            mock_send.assert_called_once_with(detector)

        # Verify detector
        assert detector.project == project
        assert detector.name == "High Error Count (Default)"
        assert detector.type == MetricIssue.slug
        assert detector.owner_team_id == team.id
        assert detector.enabled is False
        assert detector.config["detection_type"] == AlertRuleDetectionType.DYNAMIC.value

        # Verify condition group and condition
        condition_group = detector.workflow_condition_group
        assert condition_group is not None
        conditions = DataCondition.objects.filter(condition_group=condition_group)
        assert conditions.count() == 1
        condition = conditions.first()
        assert condition is not None
        assert condition.type == Condition.ANOMALY_DETECTION
        assert condition.condition_result == DetectorPriorityLevel.HIGH

        # Verify data source and subscription
        data_source = DataSource.objects.get(
            organization_id=project.organization_id,
            type="snuba_query_subscription",
        )
        assert data_source.detectors.filter(id=detector.id).exists()

        subscription = QuerySubscription.objects.get(id=int(data_source.source_id))
        assert subscription.project == project
        snuba_query = subscription.snuba_query
        assert snuba_query.aggregate == "count()"
        assert snuba_query.time_window == 60 * 15  # 15 minutes in seconds

    def test_creates_detector_without_team(self):
        """Test that detector can be created without an owner team."""
        project = self.create_project()

        with mock.patch("sentry.workflow_engine.processors.detector.send_new_detector_data"):
            detector = _ensure_metric_detector(project, owner_team_id=None, enabled=True)

        assert detector is not None
        assert detector.owner_team_id is None
        assert detector.enabled is True

    def test_send_new_detector_data_failure_blocks_creation(self):
        """Test that detector is NOT created if sending data to Seer fails."""
        project = self.create_project()

        with mock.patch(
            "sentry.workflow_engine.processors.detector.send_new_detector_data",
            side_effect=Exception("Seer unavailable"),
        ):
            with pytest.raises(Exception, match="Seer unavailable"):
                _ensure_metric_detector(project)

        # Transaction was rolled back, so no detector should exist
        assert not Detector.objects.filter(project=project, type=MetricIssue.slug).exists()

    def test_returns_existing_detector_without_creating_duplicates(self):
        """Test that calling _ensure_metric_detector twice returns the same detector."""
        project = self.create_project()

        with mock.patch("sentry.workflow_engine.processors.detector.send_new_detector_data"):
            detector1 = _ensure_metric_detector(project)
            detector2 = _ensure_metric_detector(project)

        assert detector1 is not None
        assert detector2 is not None
        assert detector1.id == detector2.id
        assert Detector.objects.filter(project=project, type=MetricIssue.slug).count() == 1
        assert DataSource.objects.filter(organization_id=project.organization_id).count() == 1
        assert QuerySubscription.objects.filter(project=project).count() == 1


class TestCreateMetricDetectorWithOwner(TestCase):
    @with_feature("organizations:default-anomaly-detector")
    @with_feature("organizations:anomaly-detection-alerts")
    def test_creates_enabled_detector_when_both_features_enabled(self):
        """Test that detector is created and enabled when both feature flags are enabled."""
        project = self.create_project()
        # Get the team that was auto-created with the project
        team = project.teams.first()
        assert team is not None

        with mock.patch("sentry.workflow_engine.processors.detector.send_new_detector_data"):
            create_metric_detector_with_owner(project, user=self.user)

        detector = Detector.objects.get(project=project, type=MetricIssue.slug)
        assert detector.name == "High Error Count (Default)"
        assert detector.owner_team_id == team.id
        assert detector.enabled is True

    @with_feature("organizations:default-anomaly-detector")
    def test_creates_disabled_detector_when_plan_feature_missing(self):
        """Test that detector is created but disabled when anomaly-detection-alerts is off."""
        project = self.create_project()

        with mock.patch("sentry.workflow_engine.processors.detector.send_new_detector_data"):
            create_metric_detector_with_owner(project, user=self.user)

        detector = Detector.objects.get(project=project, type=MetricIssue.slug)
        assert detector.enabled is False

    @with_feature({"organizations:default-anomaly-detector": False})
    def test_does_not_create_detector_when_feature_disabled(self):
        """Test that detector is not created when feature flag is disabled."""
        project = self.create_project()

        create_metric_detector_with_owner(project, user=self.user)

        assert not Detector.objects.filter(project=project, type=MetricIssue.slug).exists()

    @with_feature("organizations:default-anomaly-detector")
    def test_creates_detector_without_team(self):
        """Test that detector is created even when project has no teams."""
        project = self.create_project()
        # Remove all teams
        project.teams.clear()

        with mock.patch("sentry.workflow_engine.processors.detector.send_new_detector_data"):
            create_metric_detector_with_owner(project, user=self.user)

        detector = Detector.objects.get(project=project, type=MetricIssue.slug)
        assert detector.owner_team_id is None


class TestDisableDefaultDetectorCreation(TestCase):
    def test_context_manager_disables_signal(self):
        """Test that disable_default_detector_creation prevents default detectors."""
        with disable_default_detector_creation():
            project = self.create_project(create_default_detectors=True)

        # Default detectors should not be created
        assert not Detector.objects.filter(project=project, type=ErrorGroupType.slug).exists()
        assert not Detector.objects.filter(project=project, type=IssueStreamGroupType.slug).exists()

    def test_context_manager_reconnects_on_exception(self):
        """Test that signals are reconnected even if exception occurs."""
        try:
            with disable_default_detector_creation():
                raise ValueError("Test exception")
        except ValueError:
            pass

        # post_save signal should be reconnected
        receiver_uids = [r[0][0] for r in post_save.receivers if r[0][1] == id(Project)]
        assert "create_project_detectors" in receiver_uids

        # project_created signal should be reconnected
        project_created_uids = [r[0][0] for r in project_created.receivers]
        assert "create_metric_detector_with_owner" in project_created_uids

    @with_feature("organizations:default-anomaly-detector")
    def test_context_manager_disables_metric_detector_signal(self):
        """Test that disable_default_detector_creation also prevents metric detector creation."""
        with (
            disable_default_detector_creation(),
            mock.patch("sentry.workflow_engine.processors.detector.send_new_detector_data"),
        ):
            # fire_project_created=True ensures the project_created signal is sent
            project = self.create_project(fire_project_created=True)

        # Metric detector should not be created because the signal handler was disconnected
        assert not Detector.objects.filter(project=project, type=MetricIssue.slug).exists()
