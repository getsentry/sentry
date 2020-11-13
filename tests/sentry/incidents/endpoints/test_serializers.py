from __future__ import absolute_import

import six

from exam import fixture
from mock import patch
from rest_framework import serializers

from sentry.auth.access import from_user
from sentry.incidents.endpoints.serializers import (
    action_target_type_to_string,
    AlertRuleSerializer,
    AlertRuleTriggerSerializer,
    AlertRuleTriggerActionSerializer,
    string_to_action_type,
    string_to_action_target_type,
)
from sentry.incidents.logic import create_alert_rule_trigger, ChannelLookupTimeoutError
from sentry.incidents.models import AlertRule, AlertRuleThresholdType, AlertRuleTriggerAction
from sentry.models import Integration, Environment
from sentry.snuba.models import QueryDatasets, SnubaQueryEventType
from sentry.testutils import TestCase


class TestAlertRuleSerializer(TestCase):
    @fixture
    def valid_params(self):
        return {
            "name": "hello",
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
        return {"organization": self.organization, "access": self.access}

    def Any(self, cls):
        class Any(object):
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
                "integration": six.text_type(integration.id),
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
        "sentry.integrations.slack.utils.get_channel_id_with_timeout",
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
            six.text_type(err.exception)
            == "Could not find channel my-channel. We have timed out trying to look for it."
        )

    @patch(
        "sentry.integrations.slack.utils.get_channel_id_with_timeout",
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
        assert set(alert_rule.snuba_query.event_types) == set(
            [SnubaQueryEventType.EventType.DEFAULT]
        )
        params["event_types"] = [SnubaQueryEventType.EventType.ERROR.name.lower()]
        serializer = AlertRuleSerializer(
            context=self.context, instance=alert_rule, data=params, partial=True
        )
        assert serializer.is_valid()
        alert_rule = serializer.save()
        assert set(alert_rule.snuba_query.event_types) == set([SnubaQueryEventType.EventType.ERROR])


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
            "alert_rule": self.alert_rule,
            "trigger": self.trigger,
        }

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
                "target_identifier": six.text_type(other_user.id),
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
                "integration": six.text_type(integration.id),
            }
        )
        serializer = AlertRuleTriggerActionSerializer(context=self.context, data=base_params)
        assert serializer.is_valid()
        with self.assertRaises(serializers.ValidationError):
            serializer.save()
