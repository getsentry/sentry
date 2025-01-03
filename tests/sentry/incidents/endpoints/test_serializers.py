from __future__ import annotations

from functools import cached_property
from typing import Any
from unittest.mock import patch

import orjson
import pytest
import responses
from django.test import override_settings
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail
from slack_sdk.errors import SlackApiError
from urllib3.response import HTTPResponse

from sentry.auth.access import from_user
from sentry.incidents.logic import (
    DEFAULT_ALERT_RULE_RESOLUTION,
    DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER,
    AlertTarget,
    ChannelLookupTimeoutError,
    create_alert_rule_trigger,
)
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.incidents.serializers import (
    ACTION_TARGET_TYPE_TO_STRING,
    QUERY_TYPE_VALID_DATASETS,
    STRING_TO_ACTION_TARGET_TYPE,
    AlertRuleSerializer,
    AlertRuleTriggerActionSerializer,
    AlertRuleTriggerSerializer,
)
from sentry.integrations.opsgenie.utils import OPSGENIE_CUSTOM_PRIORITIES
from sentry.integrations.pagerduty.utils import PAGERDUTY_CUSTOM_PRIORITIES
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.integrations.slack.utils.channel import SlackChannelIdData
from sentry.models.environment import Environment
from sentry.seer.anomaly_detection.types import StoreDataResponse
from sentry.sentry_apps.services.app import app_service
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.users.models.user import User
from tests.sentry.integrations.slack.utils.test_mock_slack_response import mock_slack_response

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class TestAlertRuleSerializerBase(TestCase):
    def setUp(self):
        self.integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            external_id="1",
            provider="slack",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )


class TestAlertRuleSerializer(TestAlertRuleSerializerBase):
    @cached_property
    def valid_params(self):
        return {
            "name": "hello",
            "owner": self.user.id,
            "time_window": 10,
            "dataset": Dataset.Events.value,
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

    @cached_property
    def valid_transaction_params(self):
        params = self.valid_params.copy()
        params["dataset"] = Dataset.Transactions.value
        params["event_types"] = [SnubaQueryEventType.EventType.TRANSACTION.name.lower()]
        return params

    @cached_property
    def access(self):
        return from_user(self.user, self.organization)

    @cached_property
    def context(self):
        return {
            "organization": self.organization,
            "access": self.access,
            "user": self.user,
            "installations": app_service.installations_for_organization(
                organization_id=self.organization.id
            ),
            "integrations": integration_service.get_integrations(
                organization_id=self.organization.id
            ),
        }

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
        assert alert_rule.snuba_query is not None
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
        invalid_values = ["Invalid dataset, valid values are %s" % [item.value for item in Dataset]]
        self.run_fail_validation_test({"dataset": "events_wrong"}, {"dataset": invalid_values})
        valid_datasets_for_type = sorted(
            dataset.name.lower()
            for dataset in QUERY_TYPE_VALID_DATASETS[SnubaQuery.Type.PERFORMANCE]
        )
        self.run_fail_validation_test(
            {
                "queryType": SnubaQuery.Type.PERFORMANCE.value,
                "dataset": Dataset.Events.value,
            },
            {
                "nonFieldErrors": [
                    f"Invalid dataset for this query type. Valid datasets are {valid_datasets_for_type}"
                ]
            },
        )
        valid_datasets_for_type = sorted(
            dataset.name.lower() for dataset in QUERY_TYPE_VALID_DATASETS[SnubaQuery.Type.ERROR]
        )
        self.run_fail_validation_test(
            {
                "queryType": SnubaQuery.Type.ERROR.value,
                "dataset": Dataset.Metrics.value,
            },
            {
                "nonFieldErrors": [
                    f"Invalid dataset for this query type. Valid datasets are {valid_datasets_for_type}"
                ]
            },
        )
        self.run_fail_validation_test(
            {
                "queryType": SnubaQuery.Type.PERFORMANCE.value,
                "dataset": Dataset.PerformanceMetrics.value,
            },
            {
                "nonFieldErrors": [
                    "This project does not have access to the `generic_metrics` dataset"
                ]
            },
        )

        with self.feature("organizations:mep-rollout-flag"):
            base_params = self.valid_params.copy()
            base_params["queryType"] = SnubaQuery.Type.PERFORMANCE.value
            base_params["eventTypes"] = [SnubaQueryEventType.EventType.TRANSACTION.name.lower()]
            base_params["dataset"] = Dataset.PerformanceMetrics.value
            base_params["query"] = ""
            serializer = AlertRuleSerializer(context=self.context, data=base_params)
            assert serializer.is_valid(), serializer.errors
            alert_rule = serializer.save()
            assert alert_rule.snuba_query is not None
            assert alert_rule.snuba_query.type == SnubaQuery.Type.PERFORMANCE.value
            assert alert_rule.snuba_query.dataset == Dataset.PerformanceMetrics.value

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
                    "Invalid Metric: count_unique(123, hello): expected at most 1 argument(s) but got 2 argument(s)"
                ]
            },
        )
        self.run_fail_validation_test(
            {"aggregate": "max()"},
            {"aggregate": ["Invalid Metric: max(): expected 1 argument(s) but got 0 argument(s)"]},
        )
        aggregate = "count_unique(tags[sentry:user])"
        base_params = self.valid_params.copy()
        base_params["aggregate"] = aggregate
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.snuba_query is not None
        assert alert_rule.snuba_query.aggregate == aggregate

        aggregate = "sum(measurements.fp)"
        base_params = self.valid_transaction_params.copy()
        base_params["name"] = "measurement test"
        base_params["aggregate"] = aggregate
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.snuba_query is not None
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
        assert alert_rule.snuba_query is not None
        assert alert_rule.snuba_query.dataset == Dataset.Transactions.value
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
        payload: dict[str, Any] = {
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
        payload: dict[str, Any] = {
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
        payload["triggers"][0]["alertThreshold"] = 2
        payload["triggers"].append(
            {
                "label": "warning",
                "alertThreshold": 1,
                "actions": [
                    {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                    {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                ],
            }
        )

        serializer = AlertRuleSerializer(context=self.context, data=payload, partial=True)

        assert serializer.is_valid(), serializer.errors

        payload["thresholdType"] = AlertRuleThresholdType.BELOW.value
        payload["resolveThreshold"] = 0
        payload["triggers"][0]["alertThreshold"] = 1
        payload["triggers"].pop()

        serializer = AlertRuleSerializer(context=self.context, data=payload, partial=True)

        assert serializer.is_valid(), serializer.errors

    def test_boundary_off_by_one(self):
        actions = [
            {
                "type": "slack",
                "targetIdentifier": "my-channel",
                "targetType": "specific",
                "integration": self.integration.id,
            }
        ]
        self.run_fail_validation_test(
            {
                "thresholdType": AlertRuleThresholdType.ABOVE.value,
                "resolveThreshold": 2,
                "triggers": [
                    {
                        "label": "critical",
                        "alertThreshold": 0,
                        "actions": actions,
                    },
                ],
            },
            {
                "nonFieldErrors": [
                    ErrorDetail(
                        string="critical alert threshold must be above resolution threshold",
                        code="invalid",
                    )
                ]
            },
        )
        self.run_fail_validation_test(
            {
                "thresholdType": AlertRuleThresholdType.BELOW.value,
                "resolveThreshold": 0,
                "triggers": [
                    {
                        "label": "critical",
                        "alertThreshold": 2,
                        "actions": actions,
                    },
                ],
            },
            {
                "nonFieldErrors": [
                    ErrorDetail(
                        string="critical alert threshold must be below resolution threshold",
                        code="invalid",
                    )
                ]
            },
        )

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_invalid_alert_threshold(self, mock_seer_request):
        """
        Anomaly detection alerts cannot have a nonzero alert rule threshold
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        params = self.valid_params.copy()
        params["detection_type"] = AlertRuleDetectionType.DYNAMIC
        params["seasonality"] = AlertRuleSeasonality.AUTO
        params["sensitivity"] = AlertRuleSensitivity.MEDIUM
        params["time_window"] = 15
        serializer = AlertRuleSerializer(context=self.context, data=params)
        assert serializer.is_valid()

        with pytest.raises(
            serializers.ValidationError,
            match="Dynamic alerts cannot have a nonzero alert threshold",
        ):
            serializer.save()

        assert mock_seer_request.call_count == 1

    def test_invalid_slack_channel(self):
        # We had an error where an invalid slack channel was spitting out unclear
        # error for the user, and CREATING THE RULE. So the next save (after fixing slack action)
        # says "Name already in use". This test makes sure that is not happening anymore.
        # We save a rule with an invalid slack, make sure we get back a useful error
        # and that the rule is not created.
        base_params = self.valid_params.copy()
        base_params["name"] = "Aun1qu3n4m3"
        base_params["triggers"][0]["actions"].append(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": ACTION_TARGET_TYPE_TO_STRING[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "123",
                "integration": str(self.integration.id),
            }
        )

        with assume_test_silo_mode(SiloMode.REGION), override_settings(SILO_MODE=SiloMode.REGION):
            serializer = AlertRuleSerializer(context=self.context, data=base_params)
            assert serializer.is_valid()

            with pytest.raises(serializers.ValidationError):
                serializer.save()

        # Make sure the rule was not created.
        assert len(list(AlertRule.objects.filter(name="Aun1qu3n4m3"))) == 0

        # Make sure the action was not created.
        alert_rule_trigger_actions = list(
            AlertRuleTriggerAction.objects.filter(integration_id=self.integration.id)
        )
        assert len(alert_rule_trigger_actions) == 0

    def test_valid_metric_field(self):
        base_params = self.valid_params.copy()
        base_params.update({"name": "Aun1qu3n4m3", "aggregate": "count_unique(user)"})
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid()
        serializer.save()
        alert_rule = AlertRule.objects.get(name="Aun1qu3n4m3")
        assert alert_rule.snuba_query is not None
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
        return_value=SlackChannelIdData("#", None, True),
    )
    def test_channel_timeout(self, mock_get_channel_id):
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
        with pytest.raises(ChannelLookupTimeoutError) as excinfo:
            serializer.save()
        assert (
            str(excinfo.value)
            == "Could not find channel my-channel. We have timed out trying to look for it."
        )

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=SlackChannelIdData("#", None, True),
    )
    def test_invalid_team_with_channel_timeout(self, mock_get_channel_id):
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
        with pytest.raises(serializers.ValidationError) as excinfo:
            serializer.save()
        assert excinfo.value.detail == {"nonFieldErrors": ["Team does not exist"]}
        mock_get_channel_id.assert_called_with(
            serialize_integration(self.integration), "my-channel", 10
        )

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
        assert alert_rule.snuba_query is not None
        assert set(alert_rule.snuba_query.event_types) == {SnubaQueryEventType.EventType.DEFAULT}
        params["event_types"] = [SnubaQueryEventType.EventType.ERROR.name.lower()]
        serializer = AlertRuleSerializer(
            context=self.context, instance=alert_rule, data=params, partial=True
        )
        assert serializer.is_valid()
        alert_rule = serializer.save()
        assert alert_rule.snuba_query is not None
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
                    "Could not parse actor. Format should be `type:id` where type is `team` or `user`."
                ]
            },
        )
        self.run_fail_validation_test(
            {"owner": "user:1234567"},
            {"owner": ["User does not exist"]},
        )
        self.run_fail_validation_test(
            {"owner": "team:1234567"},
            {"owner": ["Team does not exist"]},
        )
        other_org = self.create_organization()
        other_team = self.create_team(organization=other_org)
        other_user = self.create_user()
        self.create_member(user=other_user, organization=other_org, teams=[other_team])

        self.run_fail_validation_test(
            {"owner": f"user:{other_user.id}"},
            {"owner": ["User is not a member of this organization"]},
        )
        self.run_fail_validation_test(
            {"owner": f"team:{other_team.id}"},
            {"owner": ["Team is not a member of this organization"]},
        )

        base_params = self.valid_params.copy()
        base_params.update({"owner": f"team:{self.team.id}"})
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.team_id == self.team.id
        assert alert_rule.user_id is None

        base_params.update({"name": "another_test", "owner": f"user:{self.user.id}"})
        serializer = AlertRuleSerializer(context=self.context, data=base_params)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        # Reload user for actor
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user = User.objects.get(id=self.user.id)
        assert alert_rule.user_id == self.user.id
        assert alert_rule.team_id is None

    def test_invalid_detection_type(self):
        with (
            self.feature("organizations:anomaly-detection-alerts"),
            self.feature("organizations:anomaly-detection-rollout"),
        ):
            params = self.valid_params.copy()
            params["detection_type"] = AlertRuleDetectionType.PERCENT  # requires comparison delta
            serializer = AlertRuleSerializer(context=self.context, data=params, partial=True)
            assert serializer.is_valid()
            with pytest.raises(
                serializers.ValidationError,
                match="Percentage-based alerts require a comparison delta",
            ):
                serializer.save()

    def test_comparison_delta_above(self):
        params = self.valid_params.copy()
        params["comparison_delta"] = 60
        params["resolveThreshold"] = 10
        params["triggers"][0]["alertThreshold"] = 50
        params["triggers"][1]["alertThreshold"] = 40
        params["detection_type"] = AlertRuleDetectionType.PERCENT
        serializer = AlertRuleSerializer(context=self.context, data=params, partial=True)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.comparison_delta == 60 * 60
        assert alert_rule.resolve_threshold == 110
        triggers = {trigger.label: trigger for trigger in alert_rule.alertruletrigger_set.all()}
        assert triggers["critical"].alert_threshold == 150
        assert triggers["warning"].alert_threshold == 140
        assert alert_rule.snuba_query is not None
        assert (
            alert_rule.snuba_query.resolution == DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER * 60
        )

    def test_comparison_delta_below(self):
        params = self.valid_params.copy()
        params["threshold_type"] = AlertRuleThresholdType.BELOW.value
        params["comparison_delta"] = 60
        params["resolveThreshold"] = 10
        params["triggers"][0]["alertThreshold"] = 50
        params["triggers"][1]["alertThreshold"] = 40
        params["detection_type"] = AlertRuleDetectionType.PERCENT
        serializer = AlertRuleSerializer(context=self.context, data=params, partial=True)
        assert serializer.is_valid(), serializer.errors
        alert_rule = serializer.save()
        assert alert_rule.comparison_delta == 60 * 60
        assert alert_rule.resolve_threshold == 90
        triggers = {trigger.label: trigger for trigger in alert_rule.alertruletrigger_set.all()}
        assert triggers["critical"].alert_threshold == 50
        assert triggers["warning"].alert_threshold == 60
        assert alert_rule.snuba_query is not None
        assert (
            alert_rule.snuba_query.resolution == DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER * 60
        )

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
        assert alert_rule.snuba_query is not None
        assert alert_rule.snuba_query.resolution == DEFAULT_ALERT_RULE_RESOLUTION * 60

    @override_settings(MAX_QUERY_SUBSCRIPTIONS_PER_ORG=1)
    def test_enforce_max_subscriptions(self):
        serializer = AlertRuleSerializer(context=self.context, data=self.valid_params)
        assert serializer.is_valid(), serializer.errors
        serializer.save()
        serializer = AlertRuleSerializer(context=self.context, data=self.valid_params)
        assert serializer.is_valid(), serializer.errors
        with pytest.raises(serializers.ValidationError) as excinfo:
            serializer.save()
        assert isinstance(excinfo.value.detail, list)
        assert excinfo.value.detail[0] == "You may not exceed 1 metric alerts per organization"

    def test_error_issue_status(self):
        params = self.valid_params.copy()
        params["query"] = "status:abcd"
        serializer = AlertRuleSerializer(context=self.context, data=params, partial=True)
        assert not serializer.is_valid()
        assert serializer.errors == {
            "nonFieldErrors": [
                ErrorDetail(
                    string="Invalid Query or Metric: invalid status value of 'abcd'", code="invalid"
                )
            ]
        }

        params = self.valid_params.copy()
        params["query"] = "status:unresolved"
        serializer = AlertRuleSerializer(context=self.context, data=params, partial=True)
        assert serializer.is_valid()
        alert_rule = serializer.save()
        assert alert_rule.snuba_query is not None
        assert alert_rule.snuba_query.query == "status:unresolved"

    def test_http_response_rate(self):
        with self.feature("organizations:mep-rollout-flag"):
            params = self.valid_params.copy()
            params["query"] = "span.module:http span.op:http.client"
            params["aggregate"] = "http_response_rate(3)"
            params["event_types"] = [SnubaQueryEventType.EventType.TRANSACTION.name.lower()]
            params["dataset"] = Dataset.PerformanceMetrics.value
            serializer = AlertRuleSerializer(context=self.context, data=params, partial=True)
            assert serializer.is_valid(), serializer.errors
            alert_rule = serializer.save()
            assert alert_rule.snuba_query is not None
            assert alert_rule.snuba_query.query == "span.module:http span.op:http.client"
            assert alert_rule.snuba_query.aggregate == "http_response_rate(3)"

    def test_performance_score(self):
        with self.feature("organizations:mep-rollout-flag"):
            params = self.valid_params.copy()
            params["query"] = "has:measurements.score.total"
            params["aggregate"] = "performance_score(measurements.score.lcp)"
            params["event_types"] = [SnubaQueryEventType.EventType.TRANSACTION.name.lower()]
            params["dataset"] = Dataset.PerformanceMetrics.value
            serializer = AlertRuleSerializer(context=self.context, data=params, partial=True)
            assert serializer.is_valid(), serializer.errors
            alert_rule = serializer.save()
            assert alert_rule.snuba_query is not None
            assert alert_rule.snuba_query.query == "has:measurements.score.total"
            assert alert_rule.snuba_query.aggregate == "performance_score(measurements.score.lcp)"


class TestAlertRuleTriggerSerializer(TestAlertRuleSerializerBase):
    @cached_property
    def other_project(self):
        return self.create_project()

    @cached_property
    def alert_rule(self):
        return self.create_alert_rule(projects=[self.project, self.other_project])

    @cached_property
    def access(self):
        return from_user(self.user, self.organization)

    @cached_property
    def context(self):
        return {
            "organization": self.organization,
            "access": self.access,
            "alert_rule": self.alert_rule,
        }

    def test_validation_no_params(self):
        serializer = AlertRuleTriggerSerializer(context=self.context, data={})
        assert not serializer.is_valid()
        field_is_required = ["This field is required."]
        assert serializer.errors == {
            "label": field_is_required,
            "alertThreshold": field_is_required,
        }


class TestAlertRuleTriggerActionSerializer(TestAlertRuleSerializerBase):
    def mock_conversations_info(self, channel):
        return mock_slack_response(
            "conversations_info",
            body={"ok": True, "channel": channel},
            req_args={"channel": channel},
        )

    def patch_msg_schedule_response(self, channel_id, result_name="channel"):
        body = {
            "ok": True,
            result_name: channel_id,
            "scheduled_message_id": "Q1298393284",
        }
        return mock_slack_response("chat_scheduleMessage", body)

    @cached_property
    def other_project(self):
        return self.create_project()

    @cached_property
    def alert_rule(self):
        return self.create_alert_rule(projects=[self.project, self.other_project])

    @cached_property
    def trigger(self):
        return create_alert_rule_trigger(self.alert_rule, "hello", 100)

    @cached_property
    def valid_params(self):
        return {
            "type": AlertRuleTriggerAction.get_registered_factory(
                AlertRuleTriggerAction.Type.EMAIL
            ).slug,
            "target_type": ACTION_TARGET_TYPE_TO_STRING[AlertRuleTriggerAction.TargetType.SPECIFIC],
            "target_identifier": "test@test.com",
        }

    @cached_property
    def access(self):
        return from_user(self.user, self.organization)

    @cached_property
    def context(self):
        return {
            "organization": self.organization,
            "access": self.access,
            "user": self.user,
            "alert_rule": self.alert_rule,
            "trigger": self.trigger,
        }

    @cached_property
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

    @cached_property
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
        valid_slugs = AlertRuleTriggerAction.get_all_slugs()
        invalid_values = [f"Invalid type, valid values are {valid_slugs!r}"]
        self.run_fail_validation_test({"type": 50}, {"type": invalid_values})

    def test_target_type(self):
        invalid_values = [
            "Invalid targetType, valid values are [%s]"
            % ", ".join(STRING_TO_ACTION_TARGET_TYPE.keys())
        ]
        self.run_fail_validation_test({"targetType": 50}, {"targetType": invalid_values})

    def test_user_perms(self):
        self.run_fail_validation_test(
            {
                "target_type": ACTION_TARGET_TYPE_TO_STRING[AlertRuleTriggerAction.TargetType.USER],
                "target_identifier": "1234567",
            },
            {"nonFieldErrors": ["User does not belong to this organization"]},
        )
        other_user = self.create_user()
        self.run_fail_validation_test(
            {
                "target_type": ACTION_TARGET_TYPE_TO_STRING[AlertRuleTriggerAction.TargetType.USER],
                "target_identifier": str(other_user.id),
            },
            {"nonFieldErrors": ["User does not belong to this organization"]},
        )

    def test_invalid_priority(self):
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.MSTEAMS
                ).slug,
                "targetType": ACTION_TARGET_TYPE_TO_STRING[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "priority": "P1",
            },
            {
                "priority": [
                    ErrorDetail("Can only be set for Pagerduty or Opsgenie", code="invalid")
                ]
            },
        )
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.PAGERDUTY
                ).slug,
                "targetType": ACTION_TARGET_TYPE_TO_STRING[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "priority": "P1",
            },
            {
                "priority": [
                    ErrorDetail(
                        f"Allowed priorities for Pagerduty are {str(PAGERDUTY_CUSTOM_PRIORITIES)}",
                        code="invalid",
                    )
                ]
            },
        )
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.OPSGENIE
                ).slug,
                "targetType": ACTION_TARGET_TYPE_TO_STRING[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "priority": "critical",
            },
            {
                "priority": [
                    ErrorDetail(
                        f"Allowed priorities for Opsgenie are {str(OPSGENIE_CUSTOM_PRIORITIES)}",
                        code="invalid",
                    )
                ]
            },
        )

    @patch(
        "sentry.incidents.logic.get_target_identifier_display_for_integration",
        return_value=AlertTarget("test", "test"),
    )
    def test_pagerduty_valid_priority(self, mock_get):
        params = {
            "type": AlertRuleTriggerAction.get_registered_factory(
                AlertRuleTriggerAction.Type.PAGERDUTY
            ).slug,
            "targetType": ACTION_TARGET_TYPE_TO_STRING[AlertRuleTriggerAction.TargetType.SPECIFIC],
            "targetIdentifier": "123",
            "priority": "critical",
        }
        serializer = AlertRuleTriggerActionSerializer(data=params, context=self.context)
        assert serializer.is_valid()
        action = serializer.save()
        assert action.sentry_app_config["priority"] == "critical"

    @patch(
        "sentry.incidents.logic.get_target_identifier_display_for_integration",
        return_value=AlertTarget("test", "test"),
    )
    def test_opsgenie_valid_priority(self, mock_get):
        params = {
            "type": AlertRuleTriggerAction.get_registered_factory(
                AlertRuleTriggerAction.Type.OPSGENIE
            ).slug,
            "targetType": ACTION_TARGET_TYPE_TO_STRING[AlertRuleTriggerAction.TargetType.SPECIFIC],
            "targetIdentifier": "123",
            "priority": "P1",
        }
        serializer = AlertRuleTriggerActionSerializer(data=params, context=self.context)
        assert serializer.is_valid()
        action = serializer.save()
        assert action.sentry_app_config["priority"] == "P1"

    def test_discord(self):
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.DISCORD
                ).slug,
                "targetType": ACTION_TARGET_TYPE_TO_STRING[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "123",
            },
            {"integration": ["Integration must be provided for discord"]},
        )

    def test_slack(self):
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "target_type": ACTION_TARGET_TYPE_TO_STRING[AlertRuleTriggerAction.TargetType.USER],
                "target_identifier": "123",
            },
            {"targetType": ["Invalid target type for slack. Valid types are [specific]"]},
        )
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": ACTION_TARGET_TYPE_TO_STRING[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "123",
            },
            {"integration": ["Integration must be provided for slack"]},
        )

        base_params = self.valid_params.copy()
        base_params.update(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": ACTION_TARGET_TYPE_TO_STRING[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "123",
                "integration": str(self.integration.id),
            }
        )

        serializer = AlertRuleTriggerActionSerializer(context=self.context, data=base_params)
        assert serializer.is_valid()
        with pytest.raises(serializers.ValidationError):
            serializer.save()

    def test_valid_slack_channel_id_sdk(self):
        """
        Test that when a valid Slack channel ID is provided, we look up the channel name and validate it against the targetIdentifier.
        """
        base_params = self.valid_params.copy()
        base_params.update(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": ACTION_TARGET_TYPE_TO_STRING[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "merp",
                "integration": str(self.integration.id),
            }
        )
        context = self.context.copy()
        context.update({"input_channel_id": "CSVK0921"})

        channel = {"name": "merp", "id": "CSVK0921"}

        with self.mock_conversations_info(channel):
            serializer = AlertRuleTriggerActionSerializer(context=context, data=base_params)
            assert serializer.is_valid()

            serializer.save()

            # # Make sure the action was created.
            alert_rule_trigger_actions = list(
                AlertRuleTriggerAction.objects.filter(integration_id=self.integration.id)
            )
            assert len(alert_rule_trigger_actions) == 1

    def test_invalid_slack_channel_id_sdk(self):
        """
        Test that an invalid Slack channel ID is detected and blocks the action from being saved.
        """
        base_params = self.valid_params.copy()
        base_params.update(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": ACTION_TARGET_TYPE_TO_STRING[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "merp",
                "integration": str(self.integration.id),
            }
        )
        context = self.context.copy()
        context.update({"input_channel_id": "M40W931"})

        with patch(
            "slack_sdk.web.client.WebClient.conversations_info",
            side_effect=SlackApiError("", response={"ok": False, "error": "channel_not_found"}),
        ):
            serializer = AlertRuleTriggerActionSerializer(context=context, data=base_params)
            assert not serializer.is_valid()

            # # Make sure the action was not created.
            alert_rule_trigger_actions = list(
                AlertRuleTriggerAction.objects.filter(integration_id=self.integration.id)
            )
            assert len(alert_rule_trigger_actions) == 0

    @responses.activate
    def test_invalid_slack_channel_name(self):
        """
        Test that an invalid Slack channel name is detected and blocks the action from being saved.
        """
        base_params = self.valid_params.copy()
        base_params.update(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.SLACK
                ).slug,
                "targetType": ACTION_TARGET_TYPE_TO_STRING[
                    AlertRuleTriggerAction.TargetType.SPECIFIC
                ],
                "targetIdentifier": "123",
                "integration": str(self.integration.id),
            }
        )
        context = self.context.copy()
        context.update({"input_channel_id": "CSVK0921"})

        with self.mock_conversations_info({"name": "merp", "id": "CSVK0921"}):
            serializer = AlertRuleTriggerActionSerializer(context=context, data=base_params)
            assert not serializer.is_valid()

            # # Make sure the action was not created.
            alert_rule_trigger_actions = list(
                AlertRuleTriggerAction.objects.filter(integration_id=self.integration.id)
            )
            assert len(alert_rule_trigger_actions) == 0

    def test_sentry_app_action_missing_params(self):
        self.run_fail_validation_test(
            {
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.SENTRY_APP
                ).slug,
                "target_type": ACTION_TARGET_TYPE_TO_STRING[
                    AlertRuleTriggerAction.TargetType.SENTRY_APP
                ],
                "target_identifier": "123",
                "sentry_app": self.sentry_app.id,
                "sentry_app_config": {"tag": "asdfasdfads"},
            },
            {"sentryApp": ["Missing parameter: sentry_app_installation_uuid"]},
        )

    def test_create_and_update_sentry_app_action_success(self):
        serializer = AlertRuleTriggerActionSerializer(
            context=self.context,
            data={
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.SENTRY_APP
                ).slug,
                "target_type": ACTION_TARGET_TYPE_TO_STRING[
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
            AlertRuleTriggerAction.objects.filter(sentry_app_id=self.sentry_app.id)
        )
        assert len(alert_rule_trigger_actions) == 1

        # Update action
        serializer = AlertRuleTriggerActionSerializer(
            context=self.context,
            data={
                "type": AlertRuleTriggerAction.get_registered_factory(
                    AlertRuleTriggerAction.Type.SENTRY_APP
                ).slug,
                "target_type": ACTION_TARGET_TYPE_TO_STRING[
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

        alert_rule_trigger_action = AlertRuleTriggerAction.objects.get(
            sentry_app_id=self.sentry_app.id
        )

        # Make sure the changes got applied
        assert alert_rule_trigger_action.sentry_app_config == {"channel": "#announcements"}
