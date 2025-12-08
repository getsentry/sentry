from unittest import mock

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.processors.detector import _ensure_metric_detector
from sentry.workflow_engine.types import DetectorPriorityLevel


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
        assert snuba_query.time_window == 900  # 15 minutes in seconds

    def test_creates_detector_without_team(self):
        """Test that detector can be created without an owner team."""
        project = self.create_project()

        with mock.patch("sentry.workflow_engine.processors.detector.send_new_detector_data"):
            detector = _ensure_metric_detector(project, owner_team_id=None, enabled=True)

        assert detector.owner_team_id is None
        assert detector.enabled is True

    def test_send_new_detector_data_failure_does_not_block_creation(self):
        """Test that detector is still created even if sending data to Seer fails."""
        project = self.create_project()

        with mock.patch(
            "sentry.workflow_engine.processors.detector.send_new_detector_data",
            side_effect=Exception("Seer unavailable"),
        ):
            detector = _ensure_metric_detector(project)

        assert detector is not None
        assert Detector.objects.filter(id=detector.id).exists()


class TestCreateMetricDetectorWithOwner(TestCase):
    def test_creates_detector_when_feature_enabled(self):
        """Test that detector is created when feature flag is enabled."""
        from sentry.receivers.project_detectors import create_metric_detector_with_owner

        project = self.create_project()
        # Get the team that was auto-created with the project
        team = project.teams.first()

        with (
            self.feature({"organizations:default-anomaly-detector": True}),
            mock.patch("sentry.workflow_engine.processors.detector.send_new_detector_data"),
        ):
            create_metric_detector_with_owner(project, user=self.user)

        detector = Detector.objects.get(project=project, type=MetricIssue.slug)
        assert detector.name == "High Error Count (Default)"
        assert detector.owner_team_id == team.id

    def test_does_not_create_detector_when_feature_disabled(self):
        """Test that detector is not created when feature flag is disabled."""
        from sentry.receivers.project_detectors import create_metric_detector_with_owner

        project = self.create_project()

        with self.feature({"organizations:default-anomaly-detector": False}):
            create_metric_detector_with_owner(project, user=self.user)

        assert not Detector.objects.filter(project=project, type=MetricIssue.slug).exists()

    def test_creates_detector_without_team(self):
        """Test that detector is created even when project has no teams."""
        from sentry.receivers.project_detectors import create_metric_detector_with_owner

        project = self.create_project()
        # Remove all teams
        project.teams.clear()

        with (
            self.feature({"organizations:default-anomaly-detector": True}),
            mock.patch("sentry.workflow_engine.processors.detector.send_new_detector_data"),
        ):
            create_metric_detector_with_owner(project, user=self.user)

        detector = Detector.objects.get(project=project, type=MetricIssue.slug)
        assert detector.owner_team_id is None


class TestDisableDefaultDetectorCreation(TestCase):
    def test_context_manager_disables_signal(self):
        """Test that disable_default_detector_creation prevents default detectors."""
        from sentry.grouping.grouptype import ErrorGroupType
        from sentry.receivers.project_detectors import disable_default_detector_creation
        from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

        with disable_default_detector_creation():
            project = self.create_project(create_default_detectors=True)

        # Default detectors should not be created
        assert not Detector.objects.filter(project=project, type=ErrorGroupType.slug).exists()
        assert not Detector.objects.filter(project=project, type=IssueStreamGroupType.slug).exists()

    def test_context_manager_reconnects_on_exception(self):
        """Test that signal is reconnected even if exception occurs."""
        from django.db.models.signals import post_save

        from sentry.models.project import Project
        from sentry.receivers.project_detectors import disable_default_detector_creation

        try:
            with disable_default_detector_creation():
                raise ValueError("Test exception")
        except ValueError:
            pass

        # Signal should be reconnected - check that the dispatch_uid is registered
        receiver_uids = [r[0][0] for r in post_save.receivers if r[0][1] == id(Project)]
        assert "create_project_detectors" in receiver_uids
