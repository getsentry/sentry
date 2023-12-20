from __future__ import annotations

from copy import deepcopy
from functools import cached_property
from typing import Any
from unittest.mock import patch

import responses
from django.conf import settings
from django.test import override_settings
from rest_framework.exceptions import ErrorDetail
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleSerializer
from sentry.auth.access import OrganizationGlobalAccess
from sentry.incidents.models import (
    AlertRule,
    AlertRuleStatus,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    Incident,
    IncidentStatus,
)
from sentry.incidents.serializers import AlertRuleSerializer
from sentry.integrations.slack.client import SlackClient
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.integrations.integration import Integration
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.services.hybrid_cloud.app import app_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo import SiloMode
from sentry.tasks.integrations.slack.find_channel_id_for_alert_rule import (
    find_channel_id_for_alert_rule,
)
from sentry.testutils.abstract import Abstract
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from tests.sentry.incidents.endpoints.test_organization_alert_rule_index import AlertRuleBase

pytestmark = [requires_snuba]


class AlertRuleDetailsBase(AlertRuleBase):
    __test__ = Abstract(__module__, __qualname__)

    endpoint = "sentry-api-0-organization-alert-rule-details"

    def new_alert_rule(self, data=None):
        if data is None:
            data = deepcopy(self.alert_rule_dict)

        serializer = AlertRuleSerializer(
            context={
                "organization": self.organization,
                "access": OrganizationGlobalAccess(self.organization, settings.SENTRY_SCOPES),
                "user": self.user,
                "installations": app_service.get_installed_for_organization(
                    organization_id=self.organization.id
                ),
            },
            data=data,
        )

        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        return alert_rule

    def get_serialized_alert_rule(self):
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

    @cached_property
    def alert_rule(self):
        return self.new_alert_rule(data=deepcopy(self.alert_rule_dict))

    @cached_property
    def valid_params(self):
        return {
            "name": "hello",
            "time_window": 10,
            "query": "level:error",
            "threshold_type": 0,
            "resolve_threshold": 100,
            "alert_threshold": 0,
            "aggregate": "count_unique(user)",
            "threshold_period": 1,
            "projects": [self.project.slug],
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 200,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                },
                {
                    "label": "warning",
                    "alertThreshold": 150,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                        {
                            "type": "email",
                            "targetType": "user",
                            "targetIdentifier": self.user.id,
                        },
                    ],
                },
            ],
        }

    def test_invalid_rule_id(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, 1234)

        assert resp.status_code == 404

    def test_permissions(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.create_user())
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.alert_rule.id)

        assert resp.status_code == 403

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.alert_rule.id)
        assert resp.status_code == 404


@region_silo_test
class AlertRuleDetailsGetEndpointTest(AlertRuleDetailsBase):
    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, self.alert_rule.id)

        assert resp.data == serialize(self.alert_rule, serializer=DetailedAlertRuleSerializer())

    def test_aggregate_translation(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        alert_rule = self.create_alert_rule(aggregate="count_unique(tags[sentry:user])")
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, alert_rule.id)
            assert resp.data["aggregate"] == "count_unique(user)"
            assert alert_rule.snuba_query.aggregate == "count_unique(tags[sentry:user])"

    def test_expand_latest_incident(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        incident = self.create_incident(
            organization=self.organization,
            title="Incident #1",
            projects=[self.project],
            alert_rule=self.alert_rule,
            status=IncidentStatus.CRITICAL.value,
        )
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, self.alert_rule.id, expand=["latestIncident"]
            )
            no_expand_resp = self.get_success_response(self.organization.slug, self.alert_rule.id)

        assert resp.data["latestIncident"] is not None
        assert resp.data["latestIncident"]["id"] == str(incident.id)
        assert "latestIncident" not in no_expand_resp.data

    @responses.activate
    def test_with_unresponsive_sentryapp(self):
        self.superuser = self.create_user("admin@localhost", is_superuser=True)
        self.login_as(user=self.superuser)
        self.create_team(organization=self.organization, members=[self.superuser])

        self.sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        self.installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.superuser
        )
        self.rule = self.create_alert_rule()
        trigger = self.create_alert_rule_trigger(self.rule, "hi", 1000)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger,
            target_identifier=self.sentry_app.id,
            type=AlertRuleTriggerAction.Type.SENTRY_APP,
            target_type=AlertRuleTriggerAction.TargetType.SENTRY_APP,
            sentry_app=self.sentry_app,
            sentry_app_config=[
                {"name": "title", "value": "An alert"},
                {"summary": "Something happened here..."},
                {"name": "points", "value": "3"},
                {"name": "assignee", "value": "Nisanthan"},
            ],
        )

        responses.add(responses.GET, "http://example.com/sentry/members", json={}, status=404)
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.rule.id)

        assert resp.status_code == 200
        # Returns errors while fetching
        assert len(resp.data["errors"]) == 1
        assert resp.data["errors"][0] == {
            "detail": "Could not fetch details from Super Awesome App"
        }

        # Disables the SentryApp
        assert (
            resp.data["triggers"][0]["actions"][0]["sentryAppInstallationUuid"]
            == self.installation.uuid
        )
        assert resp.data["triggers"][0]["actions"][0]["disabled"] is True

    def test_with_snooze_rule(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, alert_rule=self.alert_rule)

        with self.feature("organizations:incidents"):
            response = self.get_success_response(self.organization.slug, self.alert_rule.id)

        assert response.data["snooze"]
        assert response.data["snoozeCreatedBy"] == "You"

    def test_with_snooze_rule_everyone(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

        user2 = self.create_user("user2@example.com")
        self.snooze_rule(owner_id=user2.id, alert_rule=self.alert_rule)

        with self.feature("organizations:incidents"):
            response = self.get_success_response(self.organization.slug, self.alert_rule.id)

        assert response.data["snooze"]
        assert response.data["snoozeCreatedBy"] == user2.get_display_name()


@region_silo_test
class AlertRuleDetailsPutEndpointTest(AlertRuleDetailsBase):
    method = "put"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()
        serialized_alert_rule["name"] = "what"

        with self.feature("organizations:incidents"), outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
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

    def test_not_updated_fields(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        existing_sub = self.alert_rule.snuba_query.subscriptions.first()

        alert_rule.refresh_from_db()
        # Alert rule should be exactly the same
        assert resp.data == serialize(self.alert_rule)
        # If the aggregate changed we'd have a new subscription, validate that
        # it hasn't changed explicitly
        updated_sub = AlertRule.objects.get(id=self.alert_rule.id).snuba_query.subscriptions.first()
        assert updated_sub.subscription_id == existing_sub.subscription_id

    def test_update_trigger_label_to_unallowed_value(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)

        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()
        serialized_alert_rule["triggers"][0]["label"] = "goodbye"

        with self.feature("organizations:incidents"):
            resp = self.get_error_response(
                self.organization.slug, alert_rule.id, status_code=400, **serialized_alert_rule
            )
            assert resp.data == {"nonFieldErrors": ['Trigger 1 must be labeled "critical"']}
            serialized_alert_rule["triggers"][0]["label"] = "critical"
            serialized_alert_rule["triggers"][1]["label"] = "goodbye"
            resp = self.get_error_response(
                self.organization.slug, alert_rule.id, status_code=400, **serialized_alert_rule
            )
            assert resp.data == {"nonFieldErrors": ['Trigger 2 must be labeled "warning"']}

    def test_update_trigger_alert_threshold(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["triggers"][1]["alertThreshold"] = 125
        serialized_alert_rule["name"] = "AUniqueName"

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        assert resp.data["name"] == "AUniqueName"
        assert resp.data["triggers"][1]["alertThreshold"] == 125

    def test_delete_resolve_alert_threshold(self):
        # This is a test to make sure we can remove a resolveThreshold after it has been set.
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        alert_rule.update(resolve_threshold=75)
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["resolveThreshold"] = None
        serialized_alert_rule["name"] = "AUniqueName"

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        assert resp.data["name"] == "AUniqueName"
        assert resp.data["resolveThreshold"] is None

    def test_update_resolve_alert_threshold(self):
        # This is a test to make sure we can remove a resolveThreshold after it has been set.
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        alert_rule.update(resolve_threshold=75)
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["resolveThreshold"] = 75
        serialized_alert_rule["name"] = "AUniqueName"

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )
        assert resp.data["name"] == "AUniqueName"
        assert resp.data["resolveThreshold"] == 75

    def test_delete_trigger(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["triggers"].pop(1)

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        assert len(resp.data["triggers"]) == 1

    def test_delete_action(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["triggers"][1]["actions"].pop(1)

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        assert len(resp.data["triggers"][1]["actions"]) == 1

        # Delete the last one.
        serialized_alert_rule["triggers"][1]["actions"].pop()

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        assert len(resp.data["triggers"][1]["actions"]) == 0

    def test_update_trigger_action_type(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)

        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        # Then we send it back with one of the actions changed:
        serialized_alert_rule["triggers"][0]["actions"][0]["targetType"] = "user"
        serialized_alert_rule["triggers"][0]["actions"][0]["targetIdentifier"] = self.user.id

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        # And it comes back successfully changed:
        assert resp.data["triggers"][0]["actions"][0]["targetType"] == "user"
        assert resp.data["triggers"][0]["actions"][0]["targetIdentifier"] == str(self.user.id)

        # And make sure we still only have two triggers, the first with 1 action and the second with 2 actions
        # This is ensures they were updated and not new ones created, etc.
        assert len(resp.data["triggers"]) == 2
        assert len(resp.data["triggers"][0]["actions"]) == 1
        assert len(resp.data["triggers"][1]["actions"]) == 2

    def test_invalid_thresholds(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        serialized_alert_rule["triggers"][0]["alertThreshold"] = 50  # Invalid
        serialized_alert_rule.pop("resolveThreshold")
        with self.feature("organizations:incidents"):
            self.get_error_response(
                self.organization.slug, alert_rule.id, status_code=400, **serialized_alert_rule
            )

    def test_update_snapshot(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        # Archive the rule so that the endpoint 404's, without this, it should 200 and the test would fail:
        alert_rule.status = AlertRuleStatus.SNAPSHOT.value
        alert_rule.save()

        with self.feature("organizations:incidents"):
            self.get_error_response(
                self.organization.slug, alert_rule.id, status_code=404, **serialized_alert_rule
            )

    def test_no_owner(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )

        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()
        serialized_alert_rule["owner"] = None

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        alert_rule.refresh_from_db()
        assert resp.data == serialize(alert_rule, self.user)
        assert resp.data["owner"] is None

    def test_team_permission(self):
        # Test ensures you can only edit alerts owned by your team or no one.
        om = self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        alert_rule = self.alert_rule
        alert_rule.owner = self.team.actor
        alert_rule.save()
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()
        OrganizationMemberTeam.objects.filter(
            organizationmember__user_id=self.user.id,
            team=self.team,
        ).delete()
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, alert_rule.id, **serialized_alert_rule)
        assert resp.status_code == 200
        self.create_team_membership(team=self.team, member=om)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        alert_rule.refresh_from_db()
        assert resp.data == serialize(alert_rule, self.user)

    def test_change_name_of_existing_alert(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        test_params = self.valid_params.copy()
        test_params["resolve_threshold"] = self.alert_rule.resolve_threshold
        test_params.update({"name": "what"})

        with self.feature("organizations:incidents"), outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, self.alert_rule.id, **test_params
            )

        self.alert_rule.refresh_from_db()
        self.alert_rule.name = "what"
        self.alert_rule.snuba_query.refresh_from_db()
        assert resp.data == serialize(self.alert_rule)
        assert resp.data["name"] == "what"

        # We validate that there's only been one change to the alert
        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log_entry = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("ALERT_RULE_EDIT"), target_object=resp.data["id"]
            )
        assert len(audit_log_entry) == 1


@region_silo_test
class AlertRuleDetailsSlackPutEndpointTest(AlertRuleDetailsBase):
    method = "put"

    def _mock_slack_response(self, url: str, body: dict[str, Any], status: int = 200) -> None:
        responses.add(
            method=responses.GET,
            url=url,
            status=status,
            content_type="application/json",
            body=json.dumps(body),
        )

    def _organization_alert_rule_api_call(
        self,
        channelName: str | None = None,
        channelID: int | None = None,
    ) -> Response:
        """
        Call the project alert rule API but do some Slack integration set up before doing so
        """
        # Set up the Slack integration
        self.integration = self.create_slack_integration(
            self.organization,
            external_id="TXXXXXXX1",
            user=self.user,
        )

        # Prep steps for the API call
        test_params = self.valid_params.copy()
        test_params["triggers"] = [
            {
                "label": "critical",
                "alertThreshold": 200,
                "actions": [
                    {"type": "slack", "targetType": "specific", "integration": self.integration.id}
                ],
            },
        ]
        if channelName:
            test_params["triggers"][0]["actions"][0]["targetIdentifier"] = channelName
        if channelID:
            # The trigger code would accept channelId to be a string and that is why I don't cast it to an int
            test_params["triggers"][0]["actions"][0]["inputChannelId"] = channelID

        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.alert_rule.id, **test_params)
        return resp

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, True),
    )
    @patch.object(find_channel_id_for_alert_rule, "apply_async")
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_kicks_off_slack_async_job(
        self, mock_uuid4, mock_find_channel_id_for_alert_rule, mock_get_channel_id
    ):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        mock_uuid4.return_value = self.get_mock_uuid()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = Integration.objects.create(
                provider="slack",
                name="Team A",
                external_id="TXXXXXXX1",
                metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
            )
            self.integration.add_organization(self.organization, self.user)
        test_params = self.valid_params.copy()
        test_params["triggers"] = [
            {
                "label": "critical",
                "alertThreshold": 200,
                "actions": [
                    {
                        "type": "slack",
                        "targetIdentifier": "my-channel",
                        "targetType": "specific",
                        "integration": self.integration.id,
                    }
                ],
            },
        ]

        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.alert_rule.id, **test_params)

        # A task with this uuid has been scheduled because there's a Slack channel async search
        assert resp.data["uuid"] == "abc123"
        kwargs = {
            "organization_id": self.organization.id,
            "uuid": "abc123",
            "alert_rule_id": self.alert_rule.id,
            "data": test_params,
            "user_id": self.user.id,
        }
        mock_find_channel_id_for_alert_rule.assert_called_once_with(kwargs=kwargs)

    @responses.activate
    def test_create_slack_alert_with_name_and_channel_id(self):
        """
        The user specifies the Slack channel and channel ID (which match).
        """
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        channelName = "my-channel"
        # Specifying an inputChannelID will cause the validate_channel_id logic to be triggered
        channelID = 123
        self._mock_slack_response(
            url=f"https://slack.com/api/conversations.info?channel={channelID}",
            body={"ok": "true", "channel": {"name": channelName}},
        )
        with assume_test_silo_mode(SiloMode.REGION), override_settings(SILO_MODE=SiloMode.REGION):
            resp = self._organization_alert_rule_api_call(channelName, channelID)

        stored_action = resp.data["triggers"][0]["actions"][0]
        assert stored_action["inputChannelId"] == str(channelID)
        assert stored_action["targetIdentifier"] == channelName

    @responses.activate
    def test_create_slack_alert_with_mismatch_name_and_channel_id(self):
        """
        The user specifies the Slack channel and channel ID but they do not match.
        """
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        otherChannel = "some-other-channel"
        channelName = "my-channel"
        # Specifying an inputChannelID will cause the validate_channel_id logic to be triggered
        channelID = 123
        self._mock_slack_response(
            url=f"https://slack.com/api/conversations.info?channel={channelID}",
            body={"ok": "true", "channel": {"name": otherChannel}},
        )

        with assume_test_silo_mode(SiloMode.REGION), override_settings(SILO_MODE=SiloMode.REGION):
            resp = self._organization_alert_rule_api_call(channelName, channelID)

        assert resp.status_code == 400
        assert resp.data == {
            "nonFieldErrors": [
                ErrorDetail(
                    string=f"Received channel name {otherChannel} does not match inputted channel name {channelName}.",
                    code="invalid",
                )
            ]
        }

    # An incorrect channelID will raise an ApiError in the Slack client
    @patch.object(SlackClient, "get", side_effect=ApiError(text="channel_not_found"))
    @responses.activate
    def test_create_slack_alert_with_non_existent_channel_id(self, mock_slack_client):
        """
        The user specifies a bad Slack channel ID.
        """
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        channelName = "my-channel"
        # Specifying an inputChannelID will cause the validate_channel_id logic to be triggered
        channelID = 123
        resp = self._organization_alert_rule_api_call(channelName, channelID)

        assert resp.status_code == 400
        assert resp.data == {
            "nonFieldErrors": [
                ErrorDetail(string="Channel not found. Invalid ID provided.", code="invalid")
            ]
        }

    @patch.object(find_channel_id_for_alert_rule, "apply_async")
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    @responses.activate
    def test_create_slack_alert_with_empty_channel_id(
        self, mock_uuid4, mock_find_channel_id_for_alert_rule
    ):
        """
        The user selects the channel ID field and the UI will send the empty string to the
        endpoint, thus, a channel name search will be performed
        """
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        mock_uuid4.return_value = self.get_mock_uuid()
        channelName = "my-channel"
        # Because channel ID is None it will be converted to an async request for the channel name
        resp = self._organization_alert_rule_api_call(channelName, channelID=None)

        # A task with this uuid has been scheduled because there's a Slack channel async search
        assert resp.status_code == 202
        assert resp.data == {"uuid": "abc123"}

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        side_effect=[("#", 10, False), ("#", 10, False), ("#", 20, False)],
    )
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_async_lookup_outside_transaction(self, mock_uuid4, mock_get_channel_id):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        mock_uuid4.return_value = self.get_mock_uuid()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = Integration.objects.create(
                provider="slack",
                name="Team A",
                external_id="TXXXXXXX1",
                metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
            )
            self.integration.add_organization(self.organization, self.user)
        test_params = self.valid_params.copy()
        test_params["triggers"] = [
            {
                "label": "critical",
                "alertThreshold": 200,
                "actions": [
                    {
                        "type": "slack",
                        "targetIdentifier": "my-channel",
                        "targetType": "specific",
                        "integration": self.integration.id,
                    },
                ],
            },
        ]

        with self.feature("organizations:incidents"), self.tasks():
            resp = self.get_response(self.organization.slug, self.alert_rule.id, **test_params)

        # A task with this uuid has been scheduled because there's a Slack channel async search
        assert resp.data["uuid"] == "abc123"
        assert mock_get_channel_id.call_count == 1
        # Using get deliberately as there should only be one. Test should fail otherwise.
        trigger = AlertRuleTrigger.objects.get(alert_rule_id=self.alert_rule.id)
        action = AlertRuleTriggerAction.objects.get(alert_rule_trigger=trigger)
        assert action.target_identifier == "10"
        assert action.target_display == "my-channel"

        # Now two actions with slack:
        test_params = self.valid_params.copy()
        test_params["triggers"] = [
            {
                "label": "critical",
                "alertThreshold": 200,
                "actions": [
                    {
                        "type": "slack",
                        "targetIdentifier": "my-channel",
                        "targetType": "specific",
                        "integration": self.integration.id,
                    },
                    {
                        "type": "slack",
                        "targetIdentifier": "another-channel",
                        "targetType": "specific",
                        "integration": self.integration.id,
                    },
                    {
                        "type": "slack",
                        "targetIdentifier": "another-channel",
                        "targetType": "specific",
                        "integration": self.integration.id,
                    },
                ],
            },
            {
                "label": "warning",
                "alertThreshold": 200,
                "actions": [
                    {
                        "type": "slack",
                        "targetIdentifier": "my-channel",  # same channel, but only one lookup made per channel
                        "targetType": "specific",
                        "integration": self.integration.id,
                    },
                ],
            },
        ]

        with self.feature("organizations:incidents"), self.tasks():
            resp = self.get_response(self.organization.slug, self.alert_rule.id, **test_params)
        assert resp.data["uuid"] == "abc123"
        assert (
            mock_get_channel_id.call_count == 3
        )  # just made 2 calls, plus the call from the single action test

        # Using get deliberately as there should only be one. Test should fail otherwise.
        triggers = AlertRuleTrigger.objects.filter(alert_rule_id=self.alert_rule.id)
        actions = AlertRuleTriggerAction.objects.filter(alert_rule_trigger__in=triggers).order_by(
            "id"
        )
        # The 3 critical trigger actions:
        assert actions[0].target_identifier == "10"
        assert actions[0].target_display == "my-channel"
        assert actions[1].target_identifier == "20"
        assert actions[1].target_display == "another-channel"
        assert actions[2].target_identifier == "20"
        assert actions[2].target_display == "another-channel"

        # This is the warning trigger action:
        assert actions[3].target_identifier == "10"
        assert actions[3].target_display == "my-channel"

        # Now an invalid action (we want to early out with a good validationerror and not schedule the task):
        name = "MyInvalidActionRule"
        test_params["name"] = name
        test_params["triggers"] = [
            {
                "label": "critical",
                "alertThreshold": 75,
                "actions": [
                    {
                        "type": "element",
                        "targetIdentifier": "my-channel",
                        "targetType": "arbitrary",
                        "integrationId": self.integration.id,
                    },
                ],
            },
        ]
        with self.feature("organizations:incidents"), self.tasks():
            resp = self.get_response(self.organization.slug, self.alert_rule.id, **test_params)
        assert resp.status_code == 400
        assert (
            mock_get_channel_id.call_count == 3
        )  # Did not increment from the last assertion because we early out on the validation error


@region_silo_test
class AlertRuleDetailsSentryAppPutEndpointTest(AlertRuleDetailsBase):
    method = "put"

    def test_sentry_app(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        sentry_app = self.create_sentry_app(
            name="foo", organization=self.organization, is_alertable=True, verify_install=False
        )
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        self.login_as(self.user)
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()
        serialized_alert_rule["name"] = "ValidSentryAppTestRule"
        serialized_alert_rule["triggers"][0]["actions"][0] = {
            "type": "sentry_app",
            "targetType": "sentry_app",
            "targetIdentifier": sentry_app.id,
            "sentryAppId": sentry_app.id,
        }

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, alert_rule.id, **serialized_alert_rule
            )

        alert_rule.refresh_from_db()
        alert_rule.name = "ValidSentryAppTestRule"
        assert resp.data == serialize(alert_rule)
        assert resp.data["triggers"][0]["actions"][0]["sentryAppId"] == sentry_app.id

    def test_no_config_sentry_app(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        sentry_app = self.create_sentry_app(is_alertable=True)
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        self.login_as(self.user)
        test_params = {
            **self.valid_params,
            "triggers": [
                {
                    "actions": [
                        {
                            "type": "sentry_app",
                            "targetType": "sentry_app",
                            "targetIdentifier": sentry_app.id,
                            "sentryAppId": sentry_app.id,
                        }
                    ],
                    "alertThreshold": 300,
                    "label": "critical",
                }
            ],
        }
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            self.get_success_response(
                self.organization.slug,
                self.alert_rule.id,
                status_code=200,
                **test_params,
            )

    @responses.activate
    def test_success_response_from_sentry_app(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=202,
        )

        sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            schema={
                "elements": [
                    self.create_alert_rule_action_schema(),
                ]
            },
        )
        install = self.create_sentry_app_installation(
            slug="foo", organization=self.organization, user=self.user
        )

        sentry_app_settings = [
            {"name": "title", "value": "test title"},
            {"name": "description", "value": "test description"},
        ]

        test_params = self.valid_params.copy()
        test_params["triggers"] = [
            {
                "actions": [
                    {
                        "type": "sentry_app",
                        "targetType": "sentry_app",
                        "targetIdentifier": sentry_app.id,
                        "hasSchemaFormConfig": True,
                        "sentryAppId": sentry_app.id,
                        "sentryAppInstallationUuid": install.uuid,
                        "settings": sentry_app_settings,
                    }
                ],
                "alertThreshold": 300,
                "label": "critical",
            }
        ]

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            self.get_success_response(
                self.organization.slug,
                self.alert_rule.id,
                status_code=200,
                **test_params,
            )

    @responses.activate
    def test_error_response_from_sentry_app(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        error_message = "Everything is broken!"
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=500,
            json={"message": error_message},
        )

        sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.organization,
            schema={
                "elements": [
                    self.create_alert_rule_action_schema(),
                ]
            },
        )
        install = self.create_sentry_app_installation(
            slug="foo", organization=self.organization, user=self.user
        )

        sentry_app_settings = [
            {"name": "title", "value": "test title"},
            {"name": "description", "value": "test description"},
        ]

        test_params = self.valid_params.copy()
        test_params["triggers"] = [
            {
                "actions": [
                    {
                        "type": "sentry_app",
                        "targetType": "sentry_app",
                        "targetIdentifier": sentry_app.id,
                        "hasSchemaFormConfig": True,
                        "sentryAppId": sentry_app.id,
                        "sentryAppInstallationUuid": install.uuid,
                        "settings": sentry_app_settings,
                    }
                ],
                "alertThreshold": 300,
                "label": "critical",
            }
        ]

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_response(self.organization.slug, self.alert_rule.id, **test_params)

        assert resp.status_code == 400
        assert error_message in resp.data["sentry_app"]


@region_silo_test
class AlertRuleDetailsDeleteEndpointTest(AlertRuleDetailsBase):
    method = "delete"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

        with self.feature("organizations:incidents"), outbox_runner():
            resp = self.get_success_response(
                self.organization.slug, self.alert_rule.id, status_code=204
            )

        assert not AlertRule.objects.filter(id=self.alert_rule.id).exists()
        assert not AlertRule.objects_with_snapshots.filter(name=self.alert_rule.name).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=self.alert_rule.id).exists()

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log_entry = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("ALERT_RULE_REMOVE"), target_object=self.alert_rule.id
            )
        assert len(audit_log_entry) == 1
        assert (
            resp.renderer_context["request"].META["REMOTE_ADDR"]
            == list(audit_log_entry)[0].ip_address
        )

    def test_no_feature(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        self.get_success_response(self.organization.slug, self.alert_rule.id, status_code=204)

    def test_snapshot_and_create_new_with_same_name(self):
        with self.tasks():
            self.create_member(
                user=self.user, organization=self.organization, role="owner", teams=[self.team]
            )
            self.login_as(self.user)

            # We attach the rule to an incident so the rule is snapshotted instead of deleted.
            incident = self.create_incident(alert_rule=self.alert_rule)

            with self.feature("organizations:incidents"):
                self.get_success_response(
                    self.organization.slug, self.alert_rule.id, status_code=204
                )

            alert_rule = AlertRule.objects_with_snapshots.get(id=self.alert_rule.id)

            assert not AlertRule.objects.filter(id=alert_rule.id).exists()
            assert AlertRule.objects_with_snapshots.filter(id=alert_rule.id).exists()
            assert alert_rule.status == AlertRuleStatus.SNAPSHOT.value

            # We also confirm that the incident is automatically resolved.
            assert Incident.objects.get(id=incident.id).status == IncidentStatus.CLOSED.value

    def test_team_permission(self):
        # Test ensures you can only delete alerts owned by your team or no one.
        om = self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        alert_rule = self.alert_rule
        alert_rule.owner = self.team.actor
        alert_rule.save()
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        OrganizationMemberTeam.objects.filter(
            organizationmember__user_id=self.user.id,
            team=self.team,
        ).delete()
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, alert_rule.id)
        assert resp.status_code == 204
        another_alert_rule = self.alert_rule
        alert_rule.owner = self.team.actor
        another_alert_rule.save()
        self.create_team_membership(team=self.team, member=om)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, alert_rule.id, status_code=204)

    def test_project_permission(self):
        """Test that a user can't delete an alert in a project they do not have access to"""
        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        team = self.create_team(organization=self.organization, members=[self.user])
        project = self.create_project(name="boo", organization=self.organization, teams=[team])
        alert_rule = self.create_alert_rule(projects=[project])
        alert_rule.owner = team.actor
        alert_rule.team_id = team.id
        alert_rule.save()

        other_user = self.create_user()
        self.login_as(other_user)
        other_team = self.create_team(organization=self.organization, members=[other_user])
        other_project = self.create_project(
            name="ahh", organization=self.organization, teams=[other_team]
        )
        other_alert_rule = self.create_alert_rule(projects=[other_project])
        other_alert_rule.owner = other_team.actor
        other_alert_rule.team_id = other_team.id
        other_alert_rule.save()

        with self.feature("organizations:incidents"):
            self.get_error_response(self.organization.slug, alert_rule.id, status_code=403)

        with self.feature("organizations:incidents"):
            self.get_success_response(self.organization.slug, other_alert_rule.id, status_code=204)
