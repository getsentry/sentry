from __future__ import absolute_import

import six
from exam import fixture
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
from sentry.incidents.logic import create_alert_rule_trigger
from sentry.incidents.models import AlertRule, AlertRuleThresholdType, AlertRuleTriggerAction
from sentry.models import Integration, Environment
from sentry.snuba.models import QueryAggregations, QueryDatasets
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
            "resolve_threshold": 1,
            "alert_threshold": 0,
            "aggregation": 0,
            "threshold_period": 1,
            "projects": [self.project.slug],
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 200,
                    "resolveThreshold": 100,
                    "thresholdType": 0,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                },
                {
                    "label": "warning",
                    "alertThreshold": 150,
                    "resolveThreshold": 100,
                    "thresholdType": 0,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                        {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                    ],
                },
            ],
        }

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

    def test_validation_no_params(self):
        serializer = AlertRuleSerializer(context=self.context, data={})
        assert not serializer.is_valid()
        field_is_required = ["This field is required."]
        assert serializer.errors == {
            "name": field_is_required,
            "timeWindow": field_is_required,
            "query": field_is_required,
            "triggers": field_is_required,
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

    def test_aggregation(self):
        invalid_values = [
            "Invalid aggregation, valid values are %s" % [item.value for item in QueryAggregations]
        ]
        self.run_fail_validation_test(
            {"aggregation": "a"}, {"aggregation": ["A valid integer is required."]}
        )
        self.run_fail_validation_test({"aggregation": 50}, {"aggregation": invalid_values})

    def test_aggregate(self):
        self.run_fail_validation_test(
            {"aggregate": "what()", "aggregation": 0},
            {"nonFieldErrors": ["Invalid Query or Aggregate: what() is not a valid function"]},
        )
        self.run_fail_validation_test(
            {"aggregate": "what", "aggregation": 0},
            {"nonFieldErrors": ["Invalid Aggregate: Please pass a valid function for aggregation"]},
        )
        self.run_fail_validation_test(
            {"aggregate": "123", "aggregation": 0},
            {"nonFieldErrors": ["Invalid Aggregate: Please pass a valid function for aggregation"]},
        )
        self.run_fail_validation_test(
            {"aggregate": "count_unique(123, hello)", "aggregation": 0},
            {
                "nonFieldErrors": [
                    "Invalid Query or Aggregate: count_unique(123, hello): expected 1 arguments"
                ]
            },
        )
        self.run_fail_validation_test(
            {"aggregate": "max()", "aggregation": 0},
            {"nonFieldErrors": ["Invalid Query or Aggregate: max(): expected 1 arguments"]},
        )
        aggregate = "count_unique(tags[sentry:user])"
        base_params = self.valid_params.copy()
        base_params["aggregate"] = aggregate
        del base_params["aggregation"]
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.snuba_query.aggregate == aggregate

    def test_aggregate_and_aggregation(self):
        aggregate = "count_unique(tags[sentry:user])"
        base_params = self.valid_params.copy()
        base_params["aggregate"] = aggregate
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.snuba_query.aggregate == aggregate

    def test_simple_below_threshold(self):
        payload = {
            "name": "hello_im_a_test",
            "time_window": 10,
            "query": "level:error",
            "threshold_type": 0,
            "resolve_threshold": 1,
            "alert_threshold": 0,
            "aggregation": 0,
            "threshold_period": 1,
            "projects": [self.project.slug],
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 98,
                    "resolveThreshold": None,
                    "thresholdType": 1,
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
                "alertThreshold": 99,
                "resolveThreshold": 100,
                "thresholdType": 1,
                "actions": [
                    {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                    {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                ],
            }
        )

        serializer = AlertRuleSerializer(context=self.context, data=payload, partial=True)

        assert serializer.is_valid(), serializer.errors

    def test_boundary(self):
        payload = {
            "name": "hello_im_a_test",
            "time_window": 10,
            "query": "level:error",
            "threshold_type": 0,
            "aggregation": 0,
            "threshold_period": 1,
            "projects": [self.project.slug],
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 1,
                    "resolveThreshold": 2,
                    "thresholdType": AlertRuleThresholdType.ABOVE.value,
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
                "resolveThreshold": 1,
                "thresholdType": AlertRuleThresholdType.ABOVE.value,
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
            "thresholdType": field_is_required,
            "alertThreshold": field_is_required,
            "actions": field_is_required,
        }

    def test_threshold_type(self):
        invalid_values = [
            "Invalid threshold type, valid values are %s"
            % [item.value for item in AlertRuleThresholdType]
        ]
        self.run_fail_validation_test(
            {"thresholdType": "a"}, {"thresholdType": ["A valid integer is required."]}
        )
        self.run_fail_validation_test({"thresholdType": 50}, {"thresholdType": invalid_values})


class TestAlertRuleTriggerActionSerializer(TestCase):
    @fixture
    def other_project(self):
        return self.create_project()

    @fixture
    def alert_rule(self):
        return self.create_alert_rule(projects=[self.project, self.other_project])

    @fixture
    def trigger(self):
        return create_alert_rule_trigger(
            self.alert_rule, "hello", AlertRuleThresholdType.ABOVE, 100, 20
        )

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
