from functools import cached_property

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.serializer_parity import assert_serializer_parity
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.migration_helpers.alert_rule import migrate_alert_rule
from sentry.workflow_engine.models import IncidentGroupOpenPeriod
from tests.sentry.incidents.serializers.test_workflow_engine_base import (
    TestWorkflowEngineSerializer,
)


class BaseIncidentDetailsTest(APITestCase):
    __test__ = Abstract(__module__, __qualname__)

    endpoint = "sentry-api-0-organization-incident-details"

    def setUp(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

    @cached_property
    def organization(self):
        return self.create_organization(owner=self.create_user())

    @cached_property
    def project(self):
        return self.create_project(organization=self.organization)

    @cached_property
    def user(self):
        return self.create_user()

    def test_no_perms(self) -> None:
        incident = self.create_incident()
        self.login_as(self.create_user())
        with self.feature("organizations:incidents"):
            resp = self.get_response(incident.organization.slug, incident.id)
        assert resp.status_code == 403

    def test_no_feature(self) -> None:
        incident = self.create_incident()
        resp = self.get_response(incident.organization.slug, incident.id)
        assert resp.status_code == 404


class OrganizationIncidentDetailsTest(BaseIncidentDetailsTest):
    @freeze_time()
    def test_simple(self) -> None:
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(incident.organization.slug, incident.identifier)

        expected = serialize(incident)

        assert resp.data["id"] == expected["id"]
        assert resp.data["identifier"] == expected["identifier"]
        assert resp.data["projects"] == expected["projects"]
        assert resp.data["dateDetected"] == expected["dateDetected"]
        assert resp.data["dateCreated"] == expected["dateCreated"]
        assert resp.data["projects"] == expected["projects"]

    def test_workflow_engine_flag_off_uses_legacy_path(self) -> None:
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, incident.identifier)
        assert resp.data["id"] == str(incident.id)


class OrganizationIncidentUpdateStatusTest(BaseIncidentDetailsTest):
    method = "put"

    def get_success_response(self, *args, **params):
        params.setdefault("status", IncidentStatus.CLOSED.value)
        return super().get_success_response(*args, **params)

    def test_simple(self) -> None:
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            self.get_success_response(
                incident.organization.slug, incident.identifier, status=IncidentStatus.CLOSED.value
            )

        incident = Incident.objects.get(id=incident.id)
        assert incident.status == IncidentStatus.CLOSED.value

    def test_cannot_open(self) -> None:
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            resp = self.get_response(
                incident.organization.slug, incident.identifier, status=IncidentStatus.OPEN.value
            )
            assert resp.status_code == 400
            assert resp.data.startswith("Status cannot be changed")

    def test_invalid_status(self) -> None:
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            resp = self.get_response(incident.organization.slug, incident.identifier, status=5000)
            assert resp.status_code == 400
            assert resp.data["status"][0].startswith("Invalid value for status")


@with_feature(["organizations:incidents", "organizations:workflow-engine-rule-serializers"])
class WorkflowEngineIncidentDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-incident-details"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

        self.alert_rule = self.create_alert_rule()
        _, _, _, self.detector, _, self.ard, _, _ = migrate_alert_rule(self.alert_rule)

        self.group = self.create_group(type=MetricIssue.type_id)
        self.group.update(priority=PriorityLevel.HIGH)
        self.create_detector_group(detector=self.detector, group=self.group)
        self.gop = GroupOpenPeriod.objects.get(group=self.group, project=self.project)

    def test_dual_written_get(self) -> None:
        incident = self.create_incident(alert_rule=self.alert_rule)
        igop = IncidentGroupOpenPeriod.objects.create(
            group_open_period=self.gop,
            incident_id=incident.id,
            incident_identifier=incident.identifier,
        )

        resp = self.get_success_response(self.organization.slug, incident.identifier)

        assert resp.data["id"] == str(igop.incident_id)
        assert resp.data["identifier"] == str(igop.incident_identifier)
        assert resp.data["status"] == IncidentStatus.CRITICAL.value

    def test_single_written_get(self) -> None:
        # Single-written: no IncidentGroupOpenPeriod, no AlertRuleDetector mapping.
        self.ard.delete()
        fake_id = get_fake_id_from_object_id(self.gop.id)
        fake_detector_id = get_fake_id_from_object_id(self.detector.id)

        resp = self.get_success_response(self.organization.slug, fake_id)

        assert resp.data["id"] == str(fake_id)
        assert resp.data["identifier"] == str(fake_id)
        assert resp.data["alertRule"]["id"] == str(fake_detector_id)
        assert resp.data["status"] == IncidentStatus.CRITICAL.value

    def test_unmapped_real_identifier_returns_404(self) -> None:
        # Real identifier with no IncidentGroupOpenPeriod row and not a fake ID → 404.
        incident = self.create_incident()
        resp = self.get_response(self.organization.slug, incident.identifier)
        assert resp.status_code == 404

    def test_fake_id_cross_org_returns_404(self) -> None:
        other_org = self.create_organization(owner=self.user)
        fake_id = get_fake_id_from_object_id(self.gop.id)

        resp = self.get_response(other_org.slug, fake_id)
        assert resp.status_code == 404


class IncidentDetailsDeltaTest(APITestCase, TestWorkflowEngineSerializer):
    endpoint = "sentry-api-0-organization-incident-details"

    def setUp(self) -> None:
        super().setUp()
        self.add_warning_trigger()
        self.add_incident_data()
        self.login_as(self.user)

    @with_feature("organizations:incidents")
    def test_serializer_parity(self) -> None:
        old_resp = self.get_success_response(self.organization.slug, self.incident.identifier)

        with self.feature("organizations:workflow-engine-rule-serializers"):
            new_resp = self.get_success_response(self.organization.slug, self.incident.identifier)

        old_data = dict(old_resp.data)
        new_data = dict(new_resp.data)

        # Sort triggers for order-independent comparison.
        for data in (old_data, new_data):
            if isinstance(data.get("alertRule"), dict):
                data["alertRule"] = {
                    **data["alertRule"],
                    "triggers": sorted(
                        data["alertRule"].get("triggers", []), key=lambda t: t.get("label", "")
                    ),
                }

        assert_serializer_parity(
            old=old_data,
            new=new_data,
            known_differences={
                # migration always creates a resolve condition; the old serializer can
                # return None when AlertRule.resolve_threshold is unset.
                "alertRule.resolveThreshold",
                "alertRule.triggers.resolveThreshold",
                # WE derives status from group priority (HIGH→CRITICAL); legacy preserves
                # the incident's own status field which starts as OPEN.
                "status",
                # WE uses the live group title; legacy preserves the incident title
                # as it was at creation time.
                "title",
            },
        )
