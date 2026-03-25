from __future__ import annotations

from typing import Any

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.endpoints.serializers.alert_rule import DetailedAlertRuleSerializer
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.auditlogentry import AuditLogEntry
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.migration_helpers.alert_rule import migrate_alert_rule
from sentry.workflow_engine.models.alertrule_detector import AlertRuleDetector

pytestmark = [requires_snuba]


class AlertRuleDetailsBase(APITestCase):
    endpoint = "sentry-api-0-project-alert-rule-details"

    def setUp(self) -> None:
        super().setUp()
        self.alert_rule = self.create_alert_rule(name="hello")
        self.owner_user = self.create_user()
        self.create_member(
            user=self.owner_user, organization=self.organization, role="owner", teams=[self.team]
        )
        # Default to the 'owner' user
        self.user = self.owner_user
        self.login_as(self.user)


class AlertRuleDetailsGetEndpointTest(AlertRuleDetailsBase):
    def test_simple(self) -> None:
        # self.login_as(self.owner_user)
        with self.feature("organizations:incidents"), outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, self.alert_rule.id
            )
        assert resp.data == serialize(self.alert_rule, serializer=DetailedAlertRuleSerializer())


class AlertRuleDetailsPutEndpointTest(AlertRuleDetailsBase):
    method = "put"

    def get_serialized_alert_rule(self) -> dict[str, Any]:
        # Only call after calling self.alert_rule to create it.
        original_endpoint = self.endpoint
        original_method = self.method
        self.endpoint = "sentry-api-0-organization-alert-rules"
        self.method = "get"
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug)
            assert len(resp.data) >= 1
            serialized_alert_rule = resp.data[0]
            if serialized_alert_rule["environment"]:
                serialized_alert_rule["environment"] = serialized_alert_rule["environment"][0]
            else:
                serialized_alert_rule.pop("environment", None)
        self.endpoint = original_endpoint
        self.method = original_method
        return serialized_alert_rule

    def test_simple(self) -> None:
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()
        serialized_alert_rule["name"] = "what"
        serialized_alert_rule["triggers"] = [
            {
                "label": "critical",
                "alertThreshold": 200,
                "actions": [
                    {
                        "type": "email",
                        "targetIdentifier": self.user.id,
                        "targetType": "user",
                    },
                ],
            },
        ]

        with self.feature("organizations:incidents"), outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, alert_rule.id, **serialized_alert_rule
            )

        alert_rule.name = "what"
        alert_rule.date_modified = resp.data["dateModified"]
        assert resp.data == serialize(alert_rule)
        assert resp.data["name"] == "what"
        assert resp.data["dateModified"] > serialized_alert_rule["dateModified"]

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log_entry = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("ALERT_RULE_EDIT"), target_object=alert_rule.id
            )
        assert len(audit_log_entry) == 1
        assert (
            resp.renderer_context["request"].META["REMOTE_ADDR"]
            == list(audit_log_entry)[0].ip_address
        )


@with_feature(["organizations:incidents", "organizations:workflow-engine-rule-serializers"])
class AlertRuleDetailsGetEndpointWorkflowEngineTest(AlertRuleDetailsBase):
    def test_dual_written_resolves_detector(self) -> None:
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(self.alert_rule)
        resp = self.get_success_response(
            self.organization.slug, self.project.slug, self.alert_rule.id
        )
        assert resp.data["id"] == str(self.alert_rule.id)
        assert resp.data["name"] == self.alert_rule.name

    def test_single_written_resolves_via_fake_id(self) -> None:
        # Simulate a single-written detector by migrating the alert rule (which creates a
        # fully configured detector with data source) then removing the AlertRuleDetector bridge.
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(self.alert_rule)
        AlertRuleDetector.objects.filter(detector=detector).delete()
        fake_id = get_fake_id_from_object_id(detector.id)
        resp = self.get_success_response(self.organization.slug, self.project.slug, fake_id)
        assert resp.data["name"] == detector.name

    def test_single_written_fake_id_not_found_returns_404(self) -> None:
        fake_id = get_fake_id_from_object_id(999999999)
        self.get_error_response(self.organization.slug, self.project.slug, fake_id, status_code=404)


class AlertRuleDetailsDeleteEndpointTest(AlertRuleDetailsBase):
    method = "delete"

    def test_simple(self) -> None:
        with self.feature("organizations:incidents"), outbox_runner():
            self.get_success_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, status_code=204
            )

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=self.alert_rule.id).exists()
        assert not AlertRule.objects_with_snapshots.filter(name=self.alert_rule.id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=self.alert_rule.id).exists()

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log_entry = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("ALERT_RULE_REMOVE"), target_object=self.alert_rule.id
            )
            assert len(audit_log_entry) == 1
