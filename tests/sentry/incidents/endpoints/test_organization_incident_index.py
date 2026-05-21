from datetime import timedelta
from functools import cached_property

from sentry.constants import ObjectStatus
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_condition,
)
from sentry.workflow_engine.models import Detector, DetectorGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


@with_feature(["organizations:incidents", "organizations:performance-view"])
class WorkflowEngineIncidentListTest(APITestCase):
    endpoint = "sentry-api-0-organization-incident-index"

    @cached_property
    def organization(self):
        return self.create_organization()

    @cached_property
    def project(self):
        return self.create_project(organization=self.organization)

    @cached_property
    def user(self):
        return self.create_user()

    def test_migrated_metric_issue(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(alert_rule)
        migrate_metric_data_conditions(trigger)
        migrate_resolve_threshold_data_condition(alert_rule)

        with assume_test_silo_mode(SiloMode.CELL):
            group = self.create_group(type=MetricIssue.type_id, project=self.project)
            group.priority = PriorityLevel.HIGH.value
            group.save()
            DetectorGroup.objects.create(detector=detector, group=group)

        resp = self.get_success_response(self.organization.slug)
        assert len(resp.data) == 1

        incident_data = resp.data[0]
        assert incident_data["status"] == IncidentStatus.CRITICAL.value
        assert incident_data["organizationId"] == str(self.organization.id)
        assert incident_data["projects"] == [self.project.slug]
        assert incident_data["id"] is not None

    def test_single_written_metric_issue(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        detector = self.create_detector(
            project=self.project,
            name="Single-written detector",
            type=MetricIssue.slug,
            workflow_condition_group=self.create_data_condition_group(),
        )
        self.create_data_condition(
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=detector.workflow_condition_group,
        )
        self.create_data_condition(
            type=Condition.LESS,
            comparison=5,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=detector.workflow_condition_group,
        )

        with self.tasks():
            snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="",
                aggregate="count()",
                time_window=timedelta(minutes=1),
                resolution=timedelta(minutes=1),
                environment=None,
                event_types=[SnubaQueryEventType.EventType.ERROR],
            )
            query_subscription = create_snuba_subscription(
                project=self.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=snuba_query,
            )

        data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        self.create_data_source_detector(data_source, detector)

        with assume_test_silo_mode(SiloMode.CELL):
            group = self.create_group(type=MetricIssue.type_id, project=self.project)
            group.priority = PriorityLevel.MEDIUM.value
            group.save()
            self.create_detector_group(detector=detector, group=group)

        resp = self.get_success_response(self.organization.slug)
        assert len(resp.data) == 1

        incident_data = resp.data[0]
        assert incident_data["status"] == IncidentStatus.WARNING.value
        assert incident_data["organizationId"] == str(self.organization.id)
        assert incident_data["projects"] == [self.project.slug]
        assert incident_data["alertRule"] is not None
        assert incident_data["alertRule"]["id"] == str(get_fake_id_from_object_id(detector.id))

    def test_filter_by_fake_alert_rule_id(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(alert_rule)
        migrate_metric_data_conditions(trigger)
        migrate_resolve_threshold_data_condition(alert_rule)

        with assume_test_silo_mode(SiloMode.CELL):
            group = self.create_group(type=MetricIssue.type_id, project=self.project)
            group.priority = PriorityLevel.HIGH.value
            group.save()
            DetectorGroup.objects.create(detector=detector, group=group)

        fake_alert_rule_id = get_fake_id_from_object_id(detector.id)

        resp = self.get_success_response(self.organization.slug, alertRule=str(fake_alert_rule_id))

        assert len(resp.data) == 1
        incident_data = resp.data[0]
        assert incident_data["status"] == IncidentStatus.CRITICAL.value
        assert incident_data["organizationId"] == str(self.organization.id)
        assert incident_data["projects"] == [self.project.slug]

        fake_nonexistent_id = get_fake_id_from_object_id(999999)
        resp_empty = self.get_success_response(
            self.organization.slug, alertRule=str(fake_nonexistent_id)
        )

        assert len(resp_empty.data) == 0

    def test_filter_by_alert_rule_excludes_pending_deletion_detector(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(alert_rule)
        migrate_metric_data_conditions(trigger)
        migrate_resolve_threshold_data_condition(alert_rule)

        with assume_test_silo_mode(SiloMode.CELL):
            group = self.create_group(type=MetricIssue.type_id, project=self.project)
            group.priority = PriorityLevel.HIGH.value
            group.save()
            DetectorGroup.objects.create(detector=detector, group=group)

        # Verify the incident shows up before deletion
        resp = self.get_success_response(self.organization.slug, alertRule=str(alert_rule.id))
        assert len(resp.data) == 1

        # Mark the detector as pending deletion (bypass custom manager)
        Detector.objects_for_deletion.filter(id=detector.id).update(
            status=ObjectStatus.PENDING_DELETION
        )

        # The alert rule filter should no longer find this detector
        resp = self.get_success_response(self.organization.slug, alertRule=str(alert_rule.id))
        assert len(resp.data) == 0
