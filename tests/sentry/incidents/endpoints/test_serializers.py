from __future__ import absolute_import

import six
from exam import fixture

from sentry.auth.access import from_user
from sentry.incidents.endpoints.serializers import (
    AlertRuleSerializer,
    AlertRuleTriggerSerializer,
    AlertRuleTriggerActionSerializer,
)
from sentry.incidents.logic import (
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    InvalidTriggerActionError,
)
from sentry.incidents.models import AlertRuleThresholdType, AlertRuleTriggerAction
from sentry.models import Integration
from sentry.snuba.models import QueryAggregations
from sentry.testutils import TestCase


class TestAlertRuleSerializer(TestCase):
    @fixture
    def valid_params(self):
        return {
            "name": "something",
            "time_window": 10,
            "query": "hi",
            "threshold_type": 0,
            "resolve_threshold": 1,
            "alert_threshold": 0,
            "aggregation": 0,
            "threshold_period": 1,
            "projects": [self.project.slug],
        }

    @fixture
    def access(self):
        return from_user(self.user, self.organization)

    @fixture
    def context(self):
        return {"organization": self.organization, "access": self.access}

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
        }

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

    def test_aggregation(self):
        invalid_values = [
            "Invalid aggregation, valid values are %s" % [item.value for item in QueryAggregations]
        ]
        self.run_fail_validation_test(
            {"aggregation": "a"}, {"aggregation": ["A valid integer is required."]}
        )
        self.run_fail_validation_test({"aggregation": 50}, {"aggregation": invalid_values})

    def _run_changed_fields_test(self, alert_rule, params, expected):
        serializer = AlertRuleSerializer(
            context=self.context, instance=alert_rule, data=params, partial=True
        )
        assert serializer.is_valid(), serializer.errors
        assert (
            serializer._remove_unchanged_fields(alert_rule, serializer.validated_data) == expected
        )

    def test_remove_unchanged_fields(self):
        projects = [self.project, self.create_project()]
        name = "hello"
        query = "level:error"
        aggregation = QueryAggregations.TOTAL
        time_window = 10
        alert_rule = create_alert_rule(
            self.organization, projects, name, query, aggregation, time_window, 1
        )

        self._run_changed_fields_test(
            alert_rule,
            {
                "projects": [p.slug for p in projects],
                "name": name,
                "query": query,
                "aggregation": aggregation.value,
                "time_window": time_window,
            },
            {},
        )

        self._run_changed_fields_test(alert_rule, {"projects": [p.slug for p in projects]}, {})
        self._run_changed_fields_test(
            alert_rule, {"projects": [self.project.slug]}, {"projects": [self.project]}
        )

        self._run_changed_fields_test(alert_rule, {"name": name}, {})
        self._run_changed_fields_test(alert_rule, {"name": "a name"}, {"name": "a name"})

        self._run_changed_fields_test(alert_rule, {"query": query}, {})
        self._run_changed_fields_test(
            alert_rule, {"query": "level:warning"}, {"query": "level:warning"}
        )

        self._run_changed_fields_test(alert_rule, {"aggregation": aggregation.value}, {})
        self._run_changed_fields_test(
            alert_rule, {"aggregation": 1}, {"aggregation": QueryAggregations.UNIQUE_USERS}
        )

        self._run_changed_fields_test(alert_rule, {"time_window": time_window}, {})
        self._run_changed_fields_test(alert_rule, {"time_window": 20}, {"time_window": 20})

    def test_remove_unchanged_fields_include_all(self):
        projects = [self.project]
        excluded = [self.create_project()]
        alert_rule = self.create_alert_rule(include_all_projects=True, excluded_projects=excluded)

        self._run_changed_fields_test(
            alert_rule,
            {"include_all_projects": True, "excluded_projects": [e.slug for e in excluded]},
            {},
        )

        self._run_changed_fields_test(
            alert_rule, {"excluded_projects": [e.slug for e in excluded]}, {}
        )
        self._run_changed_fields_test(
            alert_rule,
            {"excluded_projects": [p.slug for p in projects]},
            {"excluded_projects": projects},
        )

        self._run_changed_fields_test(alert_rule, {"include_all_projects": True}, {})
        self._run_changed_fields_test(
            alert_rule, {"include_all_projects": False}, {"include_all_projects": False}
        )


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

    def _run_changed_fields_test(self, trigger, params, expected):
        serializer = AlertRuleTriggerSerializer(
            context=self.context, instance=trigger, data=params, partial=True
        )
        assert serializer.is_valid(), serializer.errors
        assert serializer._remove_unchanged_fields(trigger, serializer.validated_data) == expected

    def test_remove_unchanged_fields(self):
        excluded_projects = [self.project]
        label = "hello"
        threshold_type = AlertRuleThresholdType.ABOVE
        alert_threshold = 1000
        resolve_threshold = 400
        trigger = create_alert_rule_trigger(
            self.alert_rule,
            label,
            threshold_type,
            alert_threshold,
            resolve_threshold,
            excluded_projects=excluded_projects,
        )

        self._run_changed_fields_test(
            trigger,
            {
                "label": label,
                "threshold_type": threshold_type.value,
                "alert_threshold": alert_threshold,
                "resolve_threshold": resolve_threshold,
                "excludedProjects": [p.slug for p in excluded_projects],
            },
            {},
        )

        self._run_changed_fields_test(trigger, {"label": label}, {})
        self._run_changed_fields_test(trigger, {"label": "a name"}, {"label": "a name"})

        self._run_changed_fields_test(trigger, {"threshold_type": threshold_type.value}, {})
        self._run_changed_fields_test(
            trigger, {"threshold_type": 1}, {"threshold_type": AlertRuleThresholdType.BELOW}
        )

        self._run_changed_fields_test(trigger, {"alert_threshold": alert_threshold}, {})
        self._run_changed_fields_test(trigger, {"alert_threshold": 2000}, {"alert_threshold": 2000})

        self._run_changed_fields_test(trigger, {"resolve_threshold": resolve_threshold}, {})
        self._run_changed_fields_test(
            trigger, {"resolve_threshold": 200}, {"resolve_threshold": 200}
        )

        self._run_changed_fields_test(
            trigger, {"excluded_projects": [p.slug for p in excluded_projects]}, {}
        )
        self._run_changed_fields_test(
            trigger,
            {"excluded_projects": [self.other_project.slug]},
            {"excluded_projects": [self.other_project]},
        )


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
            "type": AlertRuleTriggerAction.Type.EMAIL.value,
            "target_type": AlertRuleTriggerAction.TargetType.SPECIFIC.value,
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
            "Invalid type, valid values are %s"
            % [item.value for item in AlertRuleTriggerAction.Type]
        ]
        self.run_fail_validation_test({"type": "a"}, {"type": ["A valid integer is required."]})
        self.run_fail_validation_test({"type": 50}, {"type": invalid_values})

    def test_target_type(self):
        invalid_values = [
            "Invalid target_type, valid values are %s"
            % [item.value for item in AlertRuleTriggerAction.TargetType]
        ]
        self.run_fail_validation_test(
            {"target_type": "a"}, {"targetType": ["A valid integer is required."]}
        )
        self.run_fail_validation_test({"targetType": 50}, {"targetType": invalid_values})

    def _run_changed_fields_test(self, trigger, params, expected):
        serializer = AlertRuleTriggerActionSerializer(
            context=self.context, instance=trigger, data=params, partial=True
        )
        assert serializer.is_valid(), serializer.errors
        assert serializer._remove_unchanged_fields(trigger, serializer.validated_data) == expected

    def test_remove_unchanged_fields(self):
        type = AlertRuleTriggerAction.Type.EMAIL
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        identifier = "hello"
        action = create_alert_rule_trigger_action(self.trigger, type, target_type, identifier)

        self._run_changed_fields_test(
            action,
            {"type": type.value, "target_type": target_type.value, "target_identifier": identifier},
            {},
        )

        self._run_changed_fields_test(action, {"type": type.value}, {})
        integration = Integration.objects.create(external_id="1", provider="slack", metadata={})

        self._run_changed_fields_test(
            action,
            {
                "type": AlertRuleTriggerAction.Type.SLACK.value,
                "targetIdentifier": "hello",
                "targetType": AlertRuleTriggerAction.TargetType.SPECIFIC.value,
                "integration": integration.id,
            },
            {"type": AlertRuleTriggerAction.Type.SLACK, "integration": integration},
        )
        self._run_changed_fields_test(
            action, {"target_type": target_type.value, "target_identifier": identifier}, {}
        )
        self._run_changed_fields_test(
            action,
            {
                "target_type": AlertRuleTriggerAction.TargetType.USER.value,
                "target_identifier": six.text_type(self.user.id),
            },
            {
                "target_type": AlertRuleTriggerAction.TargetType.USER,
                "target_identifier": six.text_type(self.user.id),
            },
        )

    def test_user_perms(self):
        self.run_fail_validation_test(
            {
                "target_type": AlertRuleTriggerAction.TargetType.USER.value,
                "target_identifier": "1234567",
            },
            {"nonFieldErrors": ["User does not exist"]},
        )
        other_user = self.create_user()
        self.run_fail_validation_test(
            {
                "target_type": AlertRuleTriggerAction.TargetType.USER.value,
                "target_identifier": six.text_type(other_user.id),
            },
            {"nonFieldErrors": ["User does not belong to this organization"]},
        )

    def test_slack(self):
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.Type.SLACK.value,
                "target_type": AlertRuleTriggerAction.TargetType.USER.value,
                "target_identifier": "123",
            },
            {"targetType": ["Must provide a specific channel for slack"]},
        )
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.Type.SLACK.value,
                "targetType": AlertRuleTriggerAction.TargetType.SPECIFIC.value,
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
                "type": AlertRuleTriggerAction.Type.SLACK.value,
                "targetType": AlertRuleTriggerAction.TargetType.SPECIFIC.value,
                "targetIdentifier": "123",
                "integration": six.text_type(integration.id),
            }
        )
        serializer = AlertRuleTriggerActionSerializer(context=self.context, data=base_params)
        assert serializer.is_valid()
        with self.assertRaises(InvalidTriggerActionError):
            serializer.save()
