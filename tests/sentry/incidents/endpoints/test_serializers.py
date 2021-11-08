from unittest.mock import patch

import responses
from exam import fixture
from rest_framework import serializers

from sentry.auth.access import from_user
from sentry.incidents.endpoints.serializers import (
    AlertRuleSerializer,
    AlertRuleTriggerActionSerializer,
    AlertRuleTriggerSerializer,
    action_target_type_to_string,
    string_to_action_target_type,
    string_to_action_type,
)
from sentry.incidents.logic import (
    DEFAULT_ALERT_RULE_RESOLUTION,
    DEFAULT_CMP_ALERT_RULE_RESOLUTION,
    ChannelLookupTimeoutError,
    create_alert_rule_trigger,
)
from sentry.incidents.models import AlertRule, AlertRuleThresholdType, AlertRuleTriggerAction
from sentry.models import ACTOR_TYPES, Environment, Integration
from sentry.snuba.models import QueryDatasets, SnubaQueryEventType
from sentry.testutils import TestCase
from sentry.utils import json


class TestAlertRuleSerializer(TestCase):
    @fixture
    def valid_params(self):
        return {
            "name": "hello",
            "owner": self.user.id,
            "time_window": 10,
            "dataset": QueryDatasets.EVENTS.value,
            "query": "level:error",
            "threshold_type": 0,
            "resolve_threshold": 100,
            "aggregate": "count()",
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
                        {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                    ],
                },
            ],
            "event_types": [SnubaQueryEventType.EventType.DEFAULT.name.lower()],
        }

    @fixture
    def valid_transaction_params(self):
        params = self.valid_params.copy()
        params["dataset"] = QueryDatasets.TRANSACTIONS.value
        params["event_types"] = [SnubaQueryEventType.EventType.TRANSACTION.name.lower()]
        return params

    @fixture
    def access(self):
        return from_user(self.user, self.organization)

    @fixture
    def context(self):
        return {"organization": self.organization, "access": self.access, "user": self.user}

    def Any(self, cls):
        class Any:
            def __eq__(self, other):
                return isinstance(other, cls)

        return Any()

    def run_fail_validation_test(self, params, errors):
        base_params = self.valid_params.copy()
        base_params.update(params)
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert not serializer.is_valid()
        assert serializer.errors == errors

    def setup_slack_integration(self):
        self.integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        self.integration.add_organization(self.organization, self.user)

    def test_validation_no_params(self):
        serializer = AlertRuleSerializer(context=self.context, data={})
        assert not serializer.is_valid()
        field_is_required = ["This field is required."]
        assert serializer.errors == {
            "name": field_is_required,
            "timeWindow": field_is_required,
            "query": field_is_required,
            "triggers": field_is_required,
            "aggregate": field_is_required,
            "thresholdType": field_is_required,
        }

    def test_environment_non_list(self):
        base_params = self.valid_params.copy()
        env_1 = Environment.objects.create(organization_id=self.organization.id, name="test_env_1")

        base_params.update({"environment": env_1.name})
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.snuba_query.environment == env_1

    def test_time_window(self):
        self.run_fail_validation_test(
            {"timeWindow": "a"}, {"timeWindow": ["A valid integer is required."]}
        )
        self.run_fail_validation_test(
            {"timeWindow": 1441},
            {"timeWindow": ["Ensure this value is less than or equal to 1440."]},
        )
        self.run_fail_validation_test(
            {"timeWindow": 0}, {"timeWindow": ["Ensure this value is greater than or equal to 1."]}
        )

    def test_dataset(self):
        invalid_values = [
            "Invalid dataset, valid values are %s" % [item.value for item in QueryDatasets]
        ]
        self.run_fail_validation_test({"dataset": "events_wrong"}, {"dataset": invalid_values})

    def test_aggregate(self):
        self.run_fail_validation_test(
            {"aggregate": "what()"},
            {"aggregate": ["Invalid Metric: what() is not a valid function"]},
        )
        self.run_fail_validation_test(
            {"aggregate": "what"},
            {"nonFieldErrors": ["Invalid Metric: Please pass a valid function for aggregation"]},
        )
        self.run_fail_validation_test(
            {"aggregate": "123"},
            {"nonFieldErrors": ["Invalid Metric: Please pass a valid function for aggregation"]},
        )
        self.run_fail_validation_test(
            {"aggregate": "count_unique(123, hello)"},
            {
                "aggregate": [
                    "Invalid Metric: count_unique(123, hello): expected at most 1 argument(s)"
                ]
            },
        )
        self.run_fail_validation_test(
            {"aggregate": "max()"}, {"aggregate": ["Invalid Metric: max(): expected 1 argument(s)"]}
        )
        aggregate = "count_unique(tags[sentry:user])"
        base_params = self.valid_params.copy()
        base_params["aggregate"] = aggregate
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.snuba_query.aggregate == aggregate

        aggregate = "sum(measurements.fp)"
        base_params = self.valid_transaction_params.copy()
        base_params["name"] = "measurement test"
        base_params["aggregate"] = aggregate
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.snuba_query.aggregate == aggregate

    def test_alert_rule_resolved_invalid(self):
        self.run_fail_validation_test(
            {"resolve_threshold": 500},
            {"nonFieldErrors": ["critical alert threshold must be above resolution threshold"]},
        )
        base_params = self.valid_params.copy()
        base_params["resolve_threshold"] = 0.5
        base_params["triggers"].pop()
        base_params["triggers"][0]["alertThreshold"] = 0.3
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert not serializer.is_valid()
        assert serializer.errors == {
            "nonFieldErrors": ["critical alert threshold must be above resolution threshold"]
        }

    def test_transaction_dataset(self):
        serializer = AlertRuleSerializer(context=self.context, data=self.valid_transaction_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.snuba_query.dataset == QueryDatasets.TRANSACTIONS.value
        assert alert_rule.snuba_query.aggregate == "count()"

    def test_query_project(self):
        self.run_fail_validation_test(
            {"query": f"project:{self.project.slug}"},
            {"query": ["Project is an invalid search term"]},
        )

    def test_decimal(self):
        params = self.valid_transaction_params.copy()
        alert_threshold = 0.8
        resolve_threshold = 0.7
        params["triggers"][0]["alertThreshold"] = alert_threshold
        params["resolve_threshold"] = resolve_threshold
        # Drop off the warning trigger
        params["triggers"].pop()
        serializer = AlertRuleSerializer(context=self.context, data=params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        trigger = alert_rule.alertruletrigger_set.filter(label="critical").get()
        assert trigger.alert_threshold == alert_threshold

    def test_simple_below_threshold(self):
        payload = {
            "name": "hello_im_a_test",
            "time_window": 10,
            "query": "level:error",
            "aggregate": "count()",
            "threshold_period": 1,
            "projects": [self.project.slug],
            "resolveThreshold": None,
            "thresholdType": 1,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 98,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                }
            ],
        }
        serializer = AlertRuleSerializer(context=self.context, data=payload, partial=True)

        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["threshold_type"] == AlertRuleThresholdType.BELOW

        # Now do a two trigger test:
        payload["triggers"].append(
            {
                "label": "warning",
                "alertThreshold": 99,
                "actions": [
                    {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                    {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                ],
            }
        )

        serializer = AlertRuleSerializer(context=self.context, data=payload, partial=True)

        assert serializer.is_valid(), serializer.errors

    def test_alert_rule_threshold_resolve_only(self):
        resolve_threshold = 10
        payload = {
            "name": "hello_im_a_test",
            "time_window": 10,
            "query": "level:error",
            "aggregate": "count()",
            "thresholdType": 0,
            "resolveThreshold": 10,
            "threshold_period": 1,
            "projects": [self.project.slug],
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 98,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                }
            ],
        }
        serializer = AlertRuleSerializer(context=self.context, data=payload, partial=True)

        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["threshold_type"] == AlertRuleThresholdType.ABOVE
        assert serializer.validated_data["resolve_threshold"] == resolve_threshold

    def test_boundary(self):
        payload = {
            "name": "hello_im_a_test",
            "time_window": 10,
            "query": "level:error",
            "aggregate": "count()",
            "threshold_period": 1,
            "resolveThreshold": 2,
            "thresholdType": AlertRuleThresholdType.ABOVE.value,
            "projects": [self.project.slug],
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 1,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                }
            ],
        }
        serializer = AlertRuleSerializer(context=self.context, data=payload, partial=True)

        assert serializer.is_valid(), serializer.errors

        # Now do a two trigger test:
        payload["triggers"].append(
            {
                "label": "warning",
                "alertThreshold": 0,
                "actions": [
                    {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                    {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                ],
            }
        )

        serializer = AlertRuleSerializer(context=self.context, data=payload, partial=True)

        assert serializer.is_valid(), serializer.errors

    def test_invalid_slack_channel(self):
        # We had an error where an invalid slack channel was spitting out unclear
        # error for the user, and CREATING THE RULE. So the next save (after fixing slack action)
        # says "Name already in use". This test makes sure that is not happening anymore.
        # We save a rule with an invalid slack, make sure we get back a useful error
        # and that the rule is not created.
        base_params = self.valid_params.copy()
        base_params["name"] = "Aun1qu3n4m3"
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(self.organization, self.user)
        base_params["triggers"][0]["actions"].append(
            {
                "type": AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": action_target_type_to_string[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "123",
                "integration": str(integration.id),
            }
        )
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid()
        with self.assertRaises(serializers.ValidationError):
            serializer.save()

        # Make sure the rule was not created.
        assert len(list(AlertRule.objects.filter(name="Aun1qu3n4m3"))) == 0

        # Make sure the action was not created.
        alert_rule_trigger_actions = list(
            AlertRuleTriggerAction.objects.filter(integration=integration)
        )
        assert len(alert_rule_trigger_actions) == 0

    def test_valid_metric_field(self):
        base_params = self.valid_params.copy()
        base_params.update({"name": "Aun1qu3n4m3", "aggregate": "count_unique(user)"})
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid()
        serializer.save()
        assert len(list(AlertRule.objects.filter(name="Aun1qu3n4m3"))) == 1
        alert_rule = AlertRule.objects.filter(name="Aun1qu3n4m3").first()
        assert alert_rule.snuba_query.aggregate == "count_unique(tags[sentry:user])"

    def test_invalid_metric_field(self):
        self.run_fail_validation_test(
            {"name": "Aun1qu3n4m3", "aggregate": "percentile(transaction.length,0.5)"},
            {
                "aggregate": [
                    "Invalid Metric: percentile(transaction.length,0.5): column argument invalid: transaction.length is not a valid column"
                ]
            },
        )

    def test_unsupported_metric_field(self):
        self.run_fail_validation_test(
            {"name": "Aun1qu3n4m3", "aggregate": "count_unique(stack.filename)"},
            {"aggregate": ["Invalid Metric: We do not currently support this field."]},
        )

    def test_threshold_type(self):
        invalid_values = [
            "Invalid threshold type, valid values are %s"
            % [item.value for item in AlertRuleThresholdType]
        ]
        self.run_fail_validation_test(
            {"thresholdType": "a"}, {"thresholdType": ["A valid integer is required."]}
        )
        self.run_fail_validation_test({"thresholdType": 50}, {"thresholdType": invalid_values})

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, True),
    )
    def test_channel_timeout(self, mock_get_channel_id):
        self.setup_slack_integration()
        trigger = {
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
        }
        base_params = self.valid_params.copy()
        base_params.update({"triggers": [trigger]})
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        # error is raised during save
        assert serializer.is_valid()
        with self.assertRaises(ChannelLookupTimeoutError) as err:
            serializer.save()
        assert (
            str(err.exception)
            == "Could not find channel my-channel. We have timed out trying to look for it."
        )

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, True),
    )
    def test_invalid_team_with_channel_timeout(self, mock_get_channel_id):
        self.setup_slack_integration()
        other_org = self.create_organization()
        new_team = self.create_team(organization=other_org)
        trigger = {
            "label": "critical",
            "alertThreshold": 200,
            "actions": [
                {
                    "type": "slack",
                    "targetIdentifier": "my-channel",
                    "targetType": "specific",
                    "integration": self.integration.id,
                },
                {"type": "email", "targetType": "team", "targetIdentifier": new_team.id},
            ],
        }
        base_params = self.valid_params.copy()
        base_params.update({"triggers": [trigger]})
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        # error is raised during save
        assert serializer.is_valid()
        with self.assertRaises(serializers.ValidationError) as err:
            serializer.save()
        assert err.exception.detail == {"nonFieldErrors": ["Team does not exist"]}
        mock_get_channel_id.assert_called_with(self.integration, "my-channel", 10)

    def test_event_types(self):
        invalid_values = [
            "Invalid event_type, valid values are %s"
            % [item.name.lower() for item in SnubaQueryEventType.EventType]
        ]
        self.run_fail_validation_test({"event_types": ["a"]}, {"eventTypes": invalid_values})
        self.run_fail_validation_test({"event_types": [1]}, {"eventTypes": invalid_values})
        self.run_fail_validation_test(
            {"event_types": ["transaction"]},
            {
                "nonFieldErrors": [
                    "Invalid event types for this dataset. Valid event types are ['default', 'error']"
                ]
            },
        )
        params = self.valid_params.copy()
        serializer = AlertRuleSerializer(context=self.context, data=params, partial=True)
        assert serializer.is_valid()
        alert_rule = serializer.save()
        assert set(alert_rule.snuba_query.event_types) == {SnubaQueryEventType.EventType.DEFAULT}
        params["event_types"] = [SnubaQueryEventType.EventType.ERROR.name.lower()]
        serializer = AlertRuleSerializer(
            context=self.context, instance=alert_rule, data=params, partial=True
        )
        assert serializer.is_valid()
        alert_rule = serializer.save()
        assert set(alert_rule.snuba_query.event_types) == {SnubaQueryEventType.EventType.ERROR}

    def test_unsupported_query(self):
        self.run_fail_validation_test(
            {"name": "Aun1qu3n4m3", "query": "release:latest"},
            {"query": ["Unsupported Query: We do not currently support the release:latest query"]},
        )

    def test_owner_validation(self):
        self.run_fail_validation_test(
            {"owner": f"meow:{self.user.id}"},
            {
                "owner": [
                    "Could not parse owner. Format should be `type:id` where type is `team` or `user`."
                ]
            },
        )
        self.run_fail_validation_test(
            {"owner": "user:1234567"},
            {"owner": ["Could not resolve owner to existing team or user."]},
        )
        self.run_fail_validation_test(
            {"owner": "team:1234567"},
            {"owner": ["Could not resolve owner to existing team or user."]},
        )
        base_params = self.valid_params.copy()
        base_params.update({"owner": f"team:{self.team.id}"})
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.owner == self.team.actor
        assert alert_rule.owner.type == ACTOR_TYPES["team"]

        base_params.update({"name": "another_test", "owner": f"user:{self.user.id}"})
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.owner == self.user.actor
        assert alert_rule.owner.type == ACTOR_TYPES["user"]

    def test_comparison_delta_above(self):
        params = self.valid_params.copy()
        params["comparison_delta"] = 60
        params["resolveThreshold"] = 10
        params["triggers"][0]["alertThreshold"] = 50
        params["triggers"][1]["alertThreshold"] = 40
        serializer = AlertRuleSerializer(context=self.context, data=params, partial=True)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.comparison_delta == 60 * 60
        assert alert_rule.resolve_threshold == 110
        triggers = {trigger.label: trigger for trigger in alert_rule.alertruletrigger_set.all()}
        assert triggers["critical"].alert_threshold == 150
        assert triggers["warning"].alert_threshold == 140
        assert alert_rule.snuba_query.resolution == DEFAULT_CMP_ALERT_RULE_RESOLUTION * 60

    def test_comparison_delta_below(self):
        params = self.valid_params.copy()
        params["threshold_type"] = AlertRuleThresholdType.BELOW.value
        params["comparison_delta"] = 60
        params["resolveThreshold"] = 10
        params["triggers"][0]["alertThreshold"] = 50
        params["triggers"][1]["alertThreshold"] = 40
        serializer = AlertRuleSerializer(context=self.context, data=params, partial=True)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.comparison_delta == 60 * 60
        assert alert_rule.resolve_threshold == 90
        triggers = {trigger.label: trigger for trigger in alert_rule.alertruletrigger_set.all()}
        assert triggers["critical"].alert_threshold == 50
        assert triggers["warning"].alert_threshold == 60
        assert alert_rule.snuba_query.resolution == DEFAULT_CMP_ALERT_RULE_RESOLUTION * 60

        params["comparison_delta"] = None
        params["resolveThreshold"] = 100
        params["triggers"][0]["alertThreshold"] = 40
        params["triggers"][1]["alertThreshold"] = 50
        serializer = AlertRuleSerializer(
            context=self.context, instance=alert_rule, data=params, partial=True
        )
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.comparison_delta is None
        assert alert_rule.snuba_query.resolution == DEFAULT_ALERT_RULE_RESOLUTION * 60


class TestAlertRuleTriggerSerializer(TestCase):
    @fixture
    def other_project(self):
        return self.create_project()

    @fixture
    def alert_rule(self):
        return self.create_alert_rule(projects=[self.project, self.other_project])

    @fixture
    def valid_params(self):
        return {
            "label": "something",
            "threshold_type": 0,
            "resolve_threshold": 1,
            "alert_threshold": 0,
            "excluded_projects": [self.project.slug],
            "actions": [{"type": "email", "targetType": "team", "targetIdentifier": self.team.id}],
        }

    @fixture
    def access(self):
        return from_user(self.user, self.organization)

    @fixture
    def context(self):
        return {
            "organization": self.organization,
            "access": self.access,
            "alert_rule": self.alert_rule,
        }

    def run_fail_validation_test(self, params, errors):
        base_params = self.valid_params.copy()
        base_params.update(params)
        serializer = AlertRuleTriggerSerializer(context=self.context, data=base_params)
        assert not serializer.is_valid()
        assert serializer.errors == errors

    def test_validation_no_params(self):
        serializer = AlertRuleTriggerSerializer(context=self.context, data={})
        assert not serializer.is_valid()
        field_is_required = ["This field is required."]
        assert serializer.errors == {
            "label": field_is_required,
            "alertThreshold": field_is_required,
        }


class TestAlertRuleTriggerActionSerializer(TestCase):
    @fixture
    def other_project(self):
        return self.create_project()

    @fixture
    def alert_rule(self):
        return self.create_alert_rule(projects=[self.project, self.other_project])

    @fixture
    def trigger(self):
        return create_alert_rule_trigger(self.alert_rule, "hello", 100)

    @fixture
    def valid_params(self):
        return {
            "type": AlertRuleTriggerAction.get_registered_type(
                AlertRuleTriggerAction.Type.EMAIL
            ).slug,
            "target_type": action_target_type_to_string[AlertRuleTriggerAction.TargetType.SPECIFIC],
            "target_identifier": "test@test.com",
        }

    @fixture
    def access(self):
        return from_user(self.user, self.organization)

    @fixture
    def context(self):
        return {
            "organization": self.organization,
            "access": self.access,
            "user": self.user,
            "alert_rule": self.alert_rule,
            "trigger": self.trigger,
        }

    @fixture
    def sentry_app(self):
        return self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
            schema={
                "elements": [
                    self.create_alert_rule_action_schema(),
                ]
            },
        )

    @fixture
    def sentry_app_installation(self):
        return self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization, user=self.user
        )

    def run_fail_validation_test(self, params, errors):
        base_params = self.valid_params.copy()
        base_params.update(params)
        serializer = AlertRuleTriggerActionSerializer(context=self.context, data=base_params)
        assert not serializer.is_valid()
        assert serializer.errors == errors

    def test_validation_no_params(self):
        serializer = AlertRuleTriggerActionSerializer(context=self.context, data={})
        assert not serializer.is_valid()
        field_is_required = ["This field is required."]
        assert serializer.errors == {
            "type": field_is_required,
            "targetType": field_is_required,
            "targetIdentifier": field_is_required,
        }

    def test_type(self):
        invalid_values = [
            "Invalid type, valid values are [%s]" % ", ".join(string_to_action_type.keys())
        ]
        self.run_fail_validation_test({"type": 50}, {"type": invalid_values})

    def test_target_type(self):
        invalid_values = [
            "Invalid targetType, valid values are [%s]"
            % ", ".join(string_to_action_target_type.keys())
        ]
        self.run_fail_validation_test({"targetType": 50}, {"targetType": invalid_values})

    def test_user_perms(self):
        self.run_fail_validation_test(
            {
                "target_type": action_target_type_to_string[AlertRuleTriggerAction.TargetType.USER],
                "target_identifier": "1234567",
            },
            {"nonFieldErrors": ["User does not exist"]},
        )
        other_user = self.create_user()
        self.run_fail_validation_test(
            {
                "target_type": action_target_type_to_string[AlertRuleTriggerAction.TargetType.USER],
                "target_identifier": str(other_user.id),
            },
            {"nonFieldErrors": ["User does not belong to this organization"]},
        )

    def test_slack(self):
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "target_type": action_target_type_to_string[AlertRuleTriggerAction.TargetType.USER],
                "target_identifier": "123",
            },
            {"targetType": ["Invalid target type for slack. Valid types are [specific]"]},
        )
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": action_target_type_to_string[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "123",
            },
            {"integration": ["Integration must be provided for slack"]},
        )
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(self.organization, self.user)

        base_params = self.valid_params.copy()
        base_params.update(
            {
                "type": AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": action_target_type_to_string[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "123",
                "integration": str(integration.id),
            }
        )
        serializer = AlertRuleTriggerActionSerializer(context=self.context, data=base_params)
        assert serializer.is_valid()
        with self.assertRaises(serializers.ValidationError):
            serializer.save()

    @responses.activate
    def test_valid_slack_channel_id(self):
        """
        Test that when a valid Slack channel ID is provided, we look up the channel name and validate it against the targetIdentifier.
        """
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(self.organization, self.user)

        base_params = self.valid_params.copy()
        base_params.update(
            {
                "type": AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": action_target_type_to_string[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "merp",
                "integration": str(integration.id),
            }
        )
        context = self.context.copy()
        context.update({"input_channel_id": "CSVK0921"})
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true", "channel": {"name": "merp", "id": "CSVK0921"}}),
        )
        serializer = AlertRuleTriggerActionSerializer(context=context, data=base_params)
        assert serializer.is_valid()

        serializer.save()

        # # Make sure the action was created.
        alert_rule_trigger_actions = list(
            AlertRuleTriggerAction.objects.filter(integration=integration)
        )
        assert len(alert_rule_trigger_actions) == 1

    @responses.activate
    def test_invalid_slack_channel_id(self):
        """
        Test that an invalid Slack channel ID is detected and blocks the action from being saved.
        """
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(self.organization, self.user)

        base_params = self.valid_params.copy()
        base_params.update(
            {
                "type": AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": action_target_type_to_string[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "merp",
                "integration": str(integration.id),
            }
        )
        context = self.context.copy()
        context.update({"input_channel_id": "M40W931"})
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": False, "error": "channel_not_found"}),
        )
        serializer = AlertRuleTriggerActionSerializer(context=context, data=base_params)
        assert not serializer.is_valid()

        # # Make sure the action was not created.
        alert_rule_trigger_actions = list(
            AlertRuleTriggerAction.objects.filter(integration=integration)
        )
        assert len(alert_rule_trigger_actions) == 0

    @responses.activate
    def test_invalid_slack_channel_name(self):
        """
        Test that an invalid Slack channel name is detected and blocks the action from being saved.
        """
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(self.organization, self.user)

        base_params = self.valid_params.copy()
        base_params.update(
            {
                "type": AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": action_target_type_to_string[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "123",
                "integration": str(integration.id),
            }
        )
        context = self.context.copy()
        context.update({"input_channel_id": "CSVK0921"})
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true", "channel": {"name": "merp", "id": "CSVK0921"}}),
        )
        serializer = AlertRuleTriggerActionSerializer(context=context, data=base_params)
        assert not serializer.is_valid()

        # # Make sure the action was not created.
        alert_rule_trigger_actions = list(
            AlertRuleTriggerAction.objects.filter(integration=integration)
        )
        assert len(alert_rule_trigger_actions) == 0

    def test_sentry_app_action_missing_params(self):

        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.SENTRY_APP
                ).slug,
                "target_type": action_target_type_to_string[
                    AlertRuleTriggerAction.TargetType.SENTRY_APP
                ],
                "target_identifier": "123",
                "sentry_app": self.sentry_app.id,
                "sentry_app_config": {"tag": "asdfasdfads"},
            },
            {"sentryApp": ["Missing paramater: sentry_app_installation_uuid"]},
        )

    @responses.activate
    def test_sentry_app_action_creator_fails(self):
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=400,
            body="Invalid channel.",
        )
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.SENTRY_APP
                ).slug,
                "target_type": action_target_type_to_string[
                    AlertRuleTriggerAction.TargetType.SENTRY_APP
                ],
                "target_identifier": "1",
                "sentry_app": self.sentry_app.id,
                "sentry_app_config": {"channel": "#santry"},
                "sentry_app_installation_uuid": self.sentry_app_installation.uuid,
            },
            {"sentryApp": ["Super Awesome App: Invalid channel."]},
        )

    @responses.activate
    def test_create_and_update_sentry_app_action_success(self):
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
            json={},
        )

        serializer = AlertRuleTriggerActionSerializer(
            context=self.context,
            data={
                "type": AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.SENTRY_APP
                ).slug,
                "target_type": action_target_type_to_string[
                    AlertRuleTriggerAction.TargetType.SENTRY_APP
                ],
                "target_identifier": "1",
                "sentry_app": self.sentry_app.id,
                "sentry_app_config": {"channel": "#general"},
                "sentry_app_installation_uuid": self.sentry_app_installation.uuid,
            },
        )
        assert serializer.is_valid()

        # Create action
        serializer.save()

        # # Make sure the action was created.
        alert_rule_trigger_actions = list(
            AlertRuleTriggerAction.objects.filter(sentry_app=self.sentry_app)
        )
        assert len(alert_rule_trigger_actions) == 1

        # Update action
        serializer = AlertRuleTriggerActionSerializer(
            context=self.context,
            data={
                "type": AlertRuleTriggerAction.get_registered_type(
                    AlertRuleTriggerAction.Type.SENTRY_APP
                ).slug,
                "target_type": action_target_type_to_string[
                    AlertRuleTriggerAction.TargetType.SENTRY_APP
                ],
                "target_identifier": "1",
                "sentry_app": self.sentry_app.id,
                "sentry_app_config": {"channel": "#announcements"},
                "sentry_app_installation_uuid": self.sentry_app_installation.uuid,
            },
            instance=alert_rule_trigger_actions[0],
        )

        assert serializer.is_valid()

        # Update action
        serializer.save()

        alert_rule_trigger_action = AlertRuleTriggerAction.objects.get(sentry_app=self.sentry_app)

        # Make sure the changes got applied
        assert alert_rule_trigger_action.sentry_app_config == {"channel": "#announcements"}
