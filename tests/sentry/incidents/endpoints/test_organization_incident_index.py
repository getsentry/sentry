from datetime import timedelta
from functools import cached_property

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models.incident import IncidentStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.actor import Actor
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_condition,
)
from sentry.workflow_engine.models import DetectorGroup, IncidentGroupOpenPeriod


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


class IncidentListDeltaTest(IncidentListEndpointTest):
    def test_workflow_engine_serializer_matches_old_serializer(self) -> None:
        # Create team and add user
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        # Create alert rule and migrate to WE models
        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(alert_rule)
        migrate_metric_data_conditions(trigger)
        migrate_resolve_threshold_data_condition(alert_rule)

        # Create incident and corresponding WE models (CRITICAL status to match HIGH priority)
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CRITICAL.value)

        # Create group and link it
        with assume_test_silo_mode(SiloMode.CELL):
            group = self.create_group(type=MetricIssue.type_id, project=self.project)
            group.priority = PriorityLevel.HIGH.value
            group.save()
            DetectorGroup.objects.create(detector=detector, group=group)

            # Get or create the GroupOpenPeriod
            group_open_period = GroupOpenPeriod.objects.get(group=group, project=self.project)
            # Align dates
            group_open_period.update(date_started=incident.date_started)

            # Create the bridge
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

        # Known differences between old and new serializers
        known_differences = {
            # statusMethod: Old system tracks actual status method (RULE_TRIGGERED vs RULE_UPDATED),
            # WE serializer infers from date_closed presence (closed=RULE_UPDATED, open=RULE_TRIGGERED).
            # May differ when status was updated by a method other than RULE_UPDATED.
            "statusMethod",
            # title: Old system uses Incident.title (set from AlertRule.name at incident creation time),
            # WE system uses Group.title (the issue title). These are typically different strings.
            "title",
            # dateDetected: Old system has separate date_detected field,
            # WE serializer sets dateDetected = date_started (GroupOpenPeriod has no separate detection date).
            "dateDetected",
            # dateCreated: Old system uses Incident.date_added,
            # WE system uses GroupOpenPeriod.date_added. These are created at different times.
            "dateCreated",
            # alertRule: The nested alert rule serialization is tested separately.
            # This test focuses on the incident-level fields.
            "alertRule",
            # activities: The activities serialization is handled separately and differs in structure.
            "activities",
        }

        mismatches: list[str] = []
        for old_incident, new_incident in zip(old_data, new_data):
            for field in set(list(old_incident.keys()) + list(new_incident.keys())):
                if field in known_differences:
                    continue
                if field not in new_incident:
                    mismatches.append(f"Missing from new: {field}")
                elif field not in old_incident:
                    mismatches.append(f"Extra in new: {field}")
                elif old_incident[field] != new_incident[field]:
                    mismatches.append(
                        f"{field}: old={old_incident[field]!r}, new={new_incident[field]!r}"
                    )

        assert not mismatches, "List old vs new serializer differences:\n" + "\n".join(mismatches)

    def test_single_written_metric_issue(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        # Create alert rule and migrate to get detector with full setup
        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(alert_rule)
        migrate_metric_data_conditions(trigger)
        migrate_resolve_threshold_data_condition(alert_rule)

        # Create a single-written group (no Incident) linked to the detector
        with assume_test_silo_mode(SiloMode.CELL):
            group = self.create_group(type=MetricIssue.type_id, project=self.project)
            group.priority = PriorityLevel.HIGH.value
            group.save()
            DetectorGroup.objects.create(detector=detector, group=group)

        # Old path should return empty (no Incident exists for this group)
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            old_resp = self.get_success_response(self.organization.slug)
        assert len(old_resp.data) == 0

        # WE path should return the single-written metric issue
        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:workflow-engine-rule-serializers",
            ]
        ):
            new_resp = self.get_success_response(self.organization.slug)
        assert len(new_resp.data) == 1

        # Verify the returned data
        incident_data = new_resp.data[0]
        assert incident_data["status"] == IncidentStatus.CRITICAL.value
        assert incident_data["organizationId"] == str(self.organization.id)
        assert incident_data["projects"] == [self.project.slug]
        # Should have a fake ID since no IncidentGroupOpenPeriod bridge exists
        assert incident_data["id"] is not None

    @with_feature(
        [
            "organizations:incidents",
            "organizations:performance-view",
            "organizations:workflow-engine-rule-serializers",
        ]
    )
    def test_filter_by_fake_alert_rule_id(self) -> None:
        """Test that we can filter by fake alert rule ID (detector_id + OFFSET)."""
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        # Create alert rule and migrate to get detector
        alert_rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(alert_rule)
        migrate_metric_data_conditions(trigger)
        migrate_resolve_threshold_data_condition(alert_rule)

        # Create a group linked to the detector
        with assume_test_silo_mode(SiloMode.CELL):
            group = self.create_group(type=MetricIssue.type_id, project=self.project)
            group.priority = PriorityLevel.HIGH.value
            group.save()
            DetectorGroup.objects.create(detector=detector, group=group)

        # Generate fake alert rule ID from detector ID
        fake_alert_rule_id = get_fake_id_from_object_id(detector.id)

        # Query using fake alert rule ID (workflow engine-only detectors)
        resp = self.get_success_response(self.organization.slug, alertRule=str(fake_alert_rule_id))

        # Should return the group linked to this detector
        assert len(resp.data) == 1
        incident_data = resp.data[0]
        assert incident_data["status"] == IncidentStatus.CRITICAL.value
        assert incident_data["organizationId"] == str(self.organization.id)
        assert incident_data["projects"] == [self.project.slug]

        # Query with non-existent fake alert rule ID should return empty
        fake_nonexistent_id = get_fake_id_from_object_id(999999)
        resp_empty = self.get_success_response(
            self.organization.slug, alertRule=str(fake_nonexistent_id)
        )

        assert len(resp_empty.data) == 0
