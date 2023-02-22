from unittest.mock import patch

import responses
from requests import Request
from rest_framework.exceptions import ErrorDetail

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.incidents.models import (
    AlertRule,
    AlertRuleStatus,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    Incident,
    IncidentStatus,
)
from sentry.integrations.slack.client import SlackClient
from sentry.models import AuditLogEntry, Integration
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json
from sentry.utils.types import Dict


@region_silo_test(stable=True)
class AlertRuleDetailsBase(APITestCase):
    endpoint = "sentry-api-0-project-alert-rule-details"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.alert_rule = self.create_alert_rule(name="hello")
        self.owner_user = self.create_user()
        self.create_member(
            user=self.owner_user, organization=self.organization, role="owner", teams=[self.team]
        )
        # Default to the 'owner' user
        self.user = self.owner_user
        self.member_user = self.create_user()
        self.create_member(
            user=self.member_user, organization=self.organization, role="member", teams=[self.team]
        )
        self.valid_params = {
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
                            "targetIdentifier": self.owner_user.id,
                        },
                    ],
                },
            ],
        }

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
        self.endpoint = original_endpoint
        self.method = original_method
        return serialized_alert_rule

    def test_invalid_rule_id(self):
        self.login_as(self.owner_user)
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.project.slug, 1234)

        assert resp.status_code == 404

    def test_permissions(self):
        self.login_as(self.create_user())
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, self.project.slug, self.alert_rule.id)

        assert resp.status_code == 403

    def test_no_feature(self):
        self.login_as(self.owner_user)
        resp = self.get_response(self.organization.slug, self.project.slug, self.alert_rule.id)
        assert resp.status_code == 404


@region_silo_test(stable=True)
class AlertRuleDetailsGetEndpointTest(AlertRuleDetailsBase):
    def test_simple(self):
        self.login_as(self.member_user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, self.alert_rule.id
            )

        assert resp.data == serialize(self.alert_rule)

    def test_aggregate_translation(self):
        self.login_as(self.owner_user)
        alert_rule = self.create_alert_rule(aggregate="count_unique(tags[sentry:user])")
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, alert_rule.id
            )
            assert resp.data["aggregate"] == "count_unique(user)"
            assert alert_rule.snuba_query.aggregate == "count_unique(tags[sentry:user])"


class AlertRuleDetailsPutEndpointTest(AlertRuleDetailsBase):
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(self.owner_user)

    def test_change_name_of_existing_alert(self):
        test_params = self.valid_params.copy()
        test_params["resolve_threshold"] = self.alert_rule.resolve_threshold
        test_params.update({"name": "what"})

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, **test_params
            )

        self.alert_rule.refresh_from_db()
        self.alert_rule.name = "what"
        self.alert_rule.snuba_query.refresh_from_db()
        assert resp.data == serialize(self.alert_rule)
        assert resp.data["name"] == "what"

        # We validate that there's only been one change to the alert
        audit_log_entry = AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("ALERT_RULE_EDIT"), target_object=resp.data["id"]
        )
        assert len(audit_log_entry) == 1

    def test_not_updated_fields(self):
        test_params = self.valid_params.copy()
        test_params["resolve_threshold"] = self.alert_rule.resolve_threshold
        test_params["aggregate"] = self.alert_rule.snuba_query.aggregate

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, **test_params
            )

        existing_sub = self.alert_rule.snuba_query.subscriptions.first()

        # Alert rule should be exactly the same
        self.alert_rule.refresh_from_db()
        assert resp.data == serialize(self.alert_rule)
        # If the aggregate changed we'd have a new subscription, validate that
        # it hasn't changed explicitly
        updated_sub = AlertRule.objects.get(id=self.alert_rule.id).snuba_query.subscriptions.first()
        assert updated_sub.subscription_id == existing_sub.subscription_id

    def test_update_snapshot(self):
        alert_rule = self.alert_rule
        # We need the IDs to force update instead of create, so we just get the rule using our own API. Like frontend would.
        serialized_alert_rule = self.get_serialized_alert_rule()

        # Archive the rule so that the endpoint 404s:
        alert_rule.status = AlertRuleStatus.SNAPSHOT.value
        alert_rule.save()

        with self.feature("organizations:incidents"):
            self.get_error_response(
                self.organization.slug,
                self.project.slug,
                alert_rule.id,
                status_code=404,
                **serialized_alert_rule,
            )

    def _mock_slack_response(self, url: str, body: Dict, status: int = 200) -> None:
        responses.add(
            method=responses.GET,
            url=url,
            status=status,
            content_type="application/json",
            body=json.dumps(body),
        )

    def _project_alert_rule_api_call(
        self,
        channelName: str = None,
        channelID: str = None,
    ) -> Request:
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
            resp = self.get_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, **test_params
            )
        return resp

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, True),
    )
    @patch("sentry.tasks.integrations.slack.find_channel_id_for_alert_rule.apply_async")
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_kicks_off_slack_async_job(
        self, mock_uuid4, mock_find_channel_id_for_alert_rule, mock_get_channel_id
    ):
        mock_uuid4.return_value = self.get_mock_uuid()
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
            resp = self.get_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, **test_params
            )

        # A task with this uuid has been scheduled because there's a Slack channel async search
        assert resp.data["uuid"] == "abc123"
        kwargs = {
            "organization_id": self.organization.id,
            "uuid": "abc123",
            "alert_rule_id": self.alert_rule.id,
            "data": test_params,
            "user_id": self.owner_user.id,
        }
        mock_find_channel_id_for_alert_rule.assert_called_once_with(kwargs=kwargs)

    @responses.activate
    def test_create_slack_alert_with_name_and_channel_id(self):
        """
        The user specifies the Slack channel and channel ID (which match).
        """
        channelName = "my-channel"
        # Specifying an inputChannelID will cause the validate_channel_id logic to be triggered
        channelID = 123
        self._mock_slack_response(
            url=f"https://slack.com/api/conversations.info?channel={channelID}",
            body={"ok": "true", "channel": {"name": channelName}},
        )
        resp = self._project_alert_rule_api_call(channelName, channelID)

        stored_action = resp.data["triggers"][0]["actions"][0]
        assert stored_action["inputChannelId"] == str(channelID)
        assert stored_action["targetIdentifier"] == channelName

    @responses.activate
    def test_create_slack_alert_with_mistmatch_name_and_channel_id(self):
        """
        The user specifies the Slack channel and channel ID but they do not match.
        """
        otherChannel = "some-other-channel"
        channelName = "my-channel"
        # Specifying an inputChannelID will cause the validate_channel_id logic to be triggered
        channelID = 123
        self._mock_slack_response(
            url=f"https://slack.com/api/conversations.info?channel={channelID}",
            body={"ok": "true", "channel": {"name": otherChannel}},
        )
        resp = self._project_alert_rule_api_call(channelName, channelID)

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
        channelName = "my-channel"
        # Specifying an inputChannelID will cause the validate_channel_id logic to be triggered
        channelID = 123
        resp = self._project_alert_rule_api_call(channelName, channelID)

        assert resp.status_code == 400
        assert resp.data == {
            "nonFieldErrors": [
                ErrorDetail(string="Channel not found. Invalid ID provided.", code="invalid")
            ]
        }

    @patch("sentry.tasks.integrations.slack.find_channel_id_for_alert_rule.apply_async")
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    @responses.activate
    def test_create_slack_alert_with_empty_channel_id(
        self, mock_uuid4, mock_find_channel_id_for_alert_rule
    ):
        """
        The user selects the channel ID field and the UI will send the empty string to the
        endpoint, thus, a channel name search will be performed
        """
        mock_uuid4.return_value = self.get_mock_uuid()
        channelName = "my-channel"
        # Because channel ID is an empty string it will be converted to an async request for the channel name
        resp = self._project_alert_rule_api_call(channelName, channelID="")

        # A task with this uuid has been scheduled because there's a Slack channel async search
        assert resp.status_code == 202
        assert resp.data == {"uuid": "abc123"}

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        side_effect=[("#", 10, False), ("#", 10, False), ("#", 20, False)],
    )
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_async_lookup_outside_transaction(self, mock_uuid4, mock_get_channel_id):
        mock_uuid4.return_value = self.get_mock_uuid()
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
            resp = self.get_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, **test_params
            )

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
            resp = self.get_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, **test_params
            )
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
            resp = self.get_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, **test_params
            )
        assert resp.status_code == 400
        assert (
            mock_get_channel_id.call_count == 3
        )  # Did not increment from the last assertion because we early out on the validation error

    def test_no_owner(self):
        alert_rule = self.alert_rule
        alert_rule.owner = self.user.actor
        alert_rule.save()
        assert alert_rule.owner == self.user.actor

        test_params = self.valid_params.copy()
        test_params["resolve_threshold"] = self.alert_rule.resolve_threshold
        test_params["owner"] = None

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, alert_rule.id, **test_params
            )

        alert_rule.refresh_from_db()
        alert_rule.snuba_query.refresh_from_db()
        assert resp.data == serialize(alert_rule, self.user)
        assert resp.data["owner"] is None

    def test_no_config_sentry_app(self):
        sentry_app = self.create_sentry_app(is_alertable=True)
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
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
                self.project.slug,
                self.alert_rule.id,
                status_code=200,
                **test_params,
            )

    @responses.activate
    def test_success_response_from_sentry_app(self):
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
                self.project.slug,
                self.alert_rule.id,
                status_code=200,
                **test_params,
            )

    @responses.activate
    def test_error_response_from_sentry_app(self):
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
            resp = self.get_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, **test_params
            )

        assert resp.status_code == 400
        assert error_message in resp.data["sentry_app"]


class AlertRuleDetailsDeleteEndpointTest(AlertRuleDetailsBase):
    method = "delete"

    def setUp(self):
        super().setUp()
        self.login_as(self.owner_user)

    def test_simple(self):
        with self.feature("organizations:incidents"):
            self.get_success_response(
                self.organization.slug, self.project.slug, self.alert_rule.id, status_code=204
            )

        assert not AlertRule.objects.filter(id=self.alert_rule.id).exists()
        assert not AlertRule.objects_with_snapshots.filter(name=self.alert_rule.id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=self.alert_rule.id).exists()

        audit_log_entry = AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("ALERT_RULE_REMOVE"), target_object=self.alert_rule.id
        )
        assert len(audit_log_entry) == 1

    def test_snapshot_and_create_new_with_same_name(self):
        with self.tasks():
            # We attach the rule to an incident so the rule is snapshotted instead of deleted.
            incident = self.create_incident(alert_rule=self.alert_rule)

            with self.feature("organizations:incidents"):
                self.get_success_response(
                    self.organization.slug, self.project.slug, self.alert_rule.id, status_code=204
                )

            alert_rule = AlertRule.objects_with_snapshots.get(id=self.alert_rule.id)

            assert not AlertRule.objects.filter(id=alert_rule.id).exists()
            assert AlertRule.objects_with_snapshots.filter(id=alert_rule.id).exists()
            assert alert_rule.status == AlertRuleStatus.SNAPSHOT.value

            # We also confirm that the incident is automatically resolved.
            assert Incident.objects.get(id=incident.id).status == IncidentStatus.CLOSED.value
