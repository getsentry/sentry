from datetime import timedelta
from functools import cached_property

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.serializer_parity import assert_serializer_parity
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.actor import Actor
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_condition,
)
from sentry.workflow_engine.models import DetectorGroup, IncidentGroupOpenPeriod
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class IncidentListEndpointTest(APITestCase):
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

    def test_simple(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        incident = self.create_incident()
        other_incident = self.create_incident(status=IncidentStatus.CLOSED.value)

        self.login_as(self.user)
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(self.organization.slug)

        assert resp.data == serialize([other_incident, incident])

    def test_filter_status(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        incident = self.create_incident()
        closed_incident = self.create_incident(status=IncidentStatus.CLOSED.value)
        self.login_as(self.user)

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp_closed = self.get_success_response(self.organization.slug, status="closed")
            resp_open = self.get_success_response(self.organization.slug, status="open")

        assert len(resp_closed.data) == 1
        assert len(resp_open.data) == 1
        assert resp_closed.data == serialize([closed_incident])
        assert resp_open.data == serialize([incident])

    def test_filter_env(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        env = self.create_environment(self.project)
        rule = self.create_alert_rule(projects=[self.project], environment=env)

        incident = self.create_incident(alert_rule=rule)
        self.create_incident()

        self.login_as(self.user)

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp_filter_env = self.get_success_response(
                self.organization.slug, environment=env.name
            )
            resp_no_env_filter = self.get_success_response(self.organization.slug)

        # The alert without an environment assigned should not be selected
        assert len(resp_filter_env.data) == 1
        assert resp_filter_env.data == serialize([incident])

        # No filter returns both incidents
        assert len(resp_no_env_filter.data) == 2

    def test_no_feature(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404

    def test_no_perf_alerts(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        # alert_rule = self.create_alert_rule()
        perf_alert_rule = self.create_alert_rule(query="p95", dataset=Dataset.Transactions)

        perf_incident = self.create_incident(alert_rule=perf_alert_rule)
        incident = self.create_incident()

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug)
            assert resp.data == serialize([incident])

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(self.organization.slug)
            assert resp.data == serialize([incident, perf_incident])

    def test_filter_start_end_times(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        old_incident = self.create_incident(date_started=timezone.now() - timedelta(hours=26))
        update_incident_status(
            incident=old_incident,
            status=IncidentStatus.CLOSED,
            date_closed=timezone.now() - timedelta(hours=25),
        )
        new_incident = self.create_incident(date_started=timezone.now() - timedelta(hours=2))
        update_incident_status(
            incident=new_incident,
            status=IncidentStatus.CLOSED,
            date_closed=timezone.now() - timedelta(hours=1),
        )
        self.login_as(self.user)
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp_all = self.get_success_response(self.organization.slug)
            resp_new = self.get_success_response(
                self.organization.slug,
                start=(timezone.now() - timedelta(hours=12)).isoformat(),
                end=timezone.now().isoformat(),
            )
            resp_old = self.get_success_response(
                self.organization.slug,
                start=(timezone.now() - timedelta(hours=36)).isoformat(),
                end=(timezone.now() - timedelta(hours=24)).isoformat(),
            )

        assert resp_all.data == serialize([new_incident, old_incident])
        assert resp_new.data == serialize([new_incident])
        assert resp_old.data == serialize([old_incident])

    def test_filter_name(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        incident = self.create_incident(title="yet another alert rule")
        self.login_as(self.user)

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            results = self.get_success_response(self.organization.slug, title="yet")
            no_results = self.get_success_response(self.organization.slug, title="no results")

        assert len(results.data) == 1
        assert len(no_results.data) == 0
        assert results.data == serialize([incident])

    def test_rule_teams(self) -> None:
        team = self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule(
            name="alert rule",
            organization=self.organization,
            projects=[self.project],
            owner=Actor.from_id(user_id=None, team_id=team.id),
        )
        other_team = self.create_team(organization=self.organization, members=[self.user])
        other_alert_rule = self.create_alert_rule(
            name="rule 2",
            organization=self.organization,
            projects=[self.project],
            owner=Actor.from_id(user_id=None, team_id=other_team.id),
        )
        unassigned_alert_rule = self.create_alert_rule(
            name="rule 66",
            organization=self.organization,
            projects=[self.project],
        )
        self.create_incident(alert_rule=alert_rule)
        self.create_incident(alert_rule=other_alert_rule)
        self.create_incident(alert_rule=unassigned_alert_rule)
        self.login_as(self.user)

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            results = self.get_success_response(self.organization.slug, project=[self.project.id])
        assert len(results.data) == 3

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            results = self.get_success_response(
                self.organization.slug, project=[self.project.id], team=[team.id]
            )
        assert len(results.data) == 1

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            results = self.get_success_response(
                self.organization.slug, project=[self.project.id], team=[team.id, other_team.id]
            )
        assert len(results.data) == 2


class IncidentListDeltaTest(APITestCase):
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

    @freeze_time("2024-12-11 03:21:34")
    def test_workflow_engine_serializer_matches_old_serializer(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(alert_rule)
        migrate_metric_data_conditions(trigger)
        migrate_resolve_threshold_data_condition(alert_rule)

        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CRITICAL.value)

        with assume_test_silo_mode(SiloMode.CELL):
            group = self.create_group(type=MetricIssue.type_id, project=self.project)
            group.priority = PriorityLevel.HIGH.value
            group.save()
            DetectorGroup.objects.create(detector=detector, group=group)

            group_open_period = GroupOpenPeriod.objects.get(group=group, project=self.project)
            group_open_period.update(date_started=incident.date_started)

            IncidentGroupOpenPeriod.objects.create(
                group_open_period=group_open_period,
                incident_id=incident.id,
                incident_identifier=incident.identifier,
            )

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            old_resp = self.get_success_response(self.organization.slug)
        old_data = old_resp.data
        assert len(old_data) > 0

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:workflow-engine-rule-serializers",
            ]
        ):
            new_resp = self.get_success_response(self.organization.slug)
        new_data = new_resp.data
        assert len(new_data) == len(old_data)

        for old_incident, new_incident in zip(old_data, new_data):
            assert_serializer_parity(
                old=old_incident,
                new=new_incident,
                known_differences={
                    # resolveThreshold: WE serializer always creates a resolve condition during migration;
                    # legacy serializer returns None when AlertRule.resolve_threshold is None.
                    "alertRule.resolveThreshold",
                    # triggers.resolveThreshold: same reason as alertRule.resolveThreshold.
                    "alertRule.triggers.resolveThreshold",
                    # triggers.label: legacy uses the user-defined trigger name; WE uses "critical"/"warning".
                    "alertRule.triggers.label",
                    # title: Old system uses Incident.title (set from AlertRule.name at incident creation time),
                    # WE system uses Group.title (the issue title). These are typically different strings.
                    "title",
                },
            )


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

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            old_resp = self.get_success_response(self.organization.slug)
        assert len(old_resp.data) == 0

        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:workflow-engine-rule-serializers",
            ]
        ):
            new_resp = self.get_success_response(self.organization.slug)
        assert len(new_resp.data) == 1

        incident_data = new_resp.data[0]
        assert incident_data["status"] == IncidentStatus.CRITICAL.value
        assert incident_data["organizationId"] == str(self.organization.id)
        assert incident_data["projects"] == [self.project.slug]
        assert incident_data["id"] is not None

    @with_feature(
        [
            "organizations:incidents",
            "organizations:performance-view",
            "organizations:workflow-engine-rule-serializers",
        ]
    )
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

    @with_feature(
        [
            "organizations:incidents",
            "organizations:performance-view",
            "organizations:workflow-engine-rule-serializers",
        ]
    )
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
