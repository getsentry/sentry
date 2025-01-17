from copy import deepcopy
from datetime import timedelta
from functools import cached_property
from unittest.mock import patch

import orjson
import pytest
import responses
from django.db import router, transaction
from django.test.utils import override_settings
from httpx import HTTPError
from rest_framework import status
from rest_framework.exceptions import ErrorDetail
from urllib3.exceptions import MaxRetryError, TimeoutError
from urllib3.response import HTTPResponse

from sentry import audit_log
from sentry.api.helpers.constants import ALERT_RULES_COUNT_HEADER, MAX_QUERY_SUBSCRIPTIONS_HEADER
from sentry.api.serializers import serialize
from sentry.conf.server import SEER_ANOMALY_DETECTION_STORE_DATA_URL
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.incidents.logic import INVALID_TIME_WINDOW
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.integrations.slack.tasks.find_channel_id_for_alert_rule import (
    find_channel_id_for_alert_rule,
)
from sentry.integrations.slack.utils.channel import SlackChannelIdData
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.organizationmember import OrganizationMember
from sentry.seer.anomaly_detection.store_data import seer_anomaly_detection_connection_pool
from sentry.seer.anomaly_detection.types import StoreDataResponse
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from tests.sentry.workflow_engine.migration_helpers.test_migrate_alert_rule import (
    assert_alert_rule_migrated,
)

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class AlertRuleBase(APITestCase):
    __test__ = Abstract(__module__, __qualname__)

    @cached_property
    def organization(self):
        return self.create_organization()

    @cached_property
    def project(self):
        return self.create_project(organization=self.organization)

    @cached_property
    def user(self):
        return self.create_user()

    @cached_property
    def alert_rule_dict(self):
        return {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "resolveThreshold": 100,
            "thresholdType": 0,
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
            "projects": [self.project.slug],
            "owner": self.user.id,
            "name": "JustAValidTestRule",
        }

    @cached_property
    def dynamic_alert_rule_dict(self):
        return {
            "aggregate": "count()",
            "query": "",
            "time_window": 30,
            "detection_type": AlertRuleDetectionType.DYNAMIC,
            "sensitivity": AlertRuleSensitivity.LOW,
            "seasonality": AlertRuleSeasonality.AUTO,
            "thresholdType": 0,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 0,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                },
                {
                    "label": "warning",
                    "alertThreshold": 0,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                        {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                    ],
                },
            ],
            "projects": [self.project.slug],
            "owner": self.user.id,
            "name": "JustAValidTestRule",
        }


class AlertRuleIndexBase(AlertRuleBase):
    __test__ = Abstract(__module__, __qualname__)

    endpoint = "sentry-api-0-organization-alert-rules"

    def setUp(self):
        super().setUp()
        self.integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        self.slack_action = [
            {
                "type": "slack",
                "targetIdentifier": "my-channel",
                "targetType": "specific",
                "integration": self.integration.id,
            }
        ]


class AlertRuleListEndpointTest(AlertRuleIndexBase):
    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule()

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug)

        assert resp.data == serialize([alert_rule])

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404

    def test_response_headers(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.create_alert_rule()
        self.login_as(self.user)

        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug)

        assert resp[ALERT_RULES_COUNT_HEADER] == "1"
        assert resp[MAX_QUERY_SUBSCRIPTIONS_HEADER] == "1000"


@freeze_time()
class AlertRuleCreateEndpointTest(AlertRuleIndexBase, SnubaTestCase):
    method = "post"

    @assume_test_silo_mode(SiloMode.CONTROL)
    def setUp(self):
        super().setUp()

        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

    def test_simple(self):
        with (
            outbox_runner(),
            self.feature(["organizations:incidents", "organizations:performance-view"]),
        ):
            resp = self.get_success_response(
                self.organization.slug,
                status_code=201,
                **self.alert_rule_dict,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log_entry = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("ALERT_RULE_ADD"), target_object=alert_rule.id
            )
        assert len(audit_log_entry) == 1
        assert (
            resp.renderer_context["request"].META["REMOTE_ADDR"]
            == list(audit_log_entry)[0].ip_address
        )

    @with_feature("organizations:workflow-engine-metric-alert-processing")
    def test_create_alert_rule_aci(self):
        with (
            outbox_runner(),
            self.feature(["organizations:incidents", "organizations:performance-view"]),
        ):
            resp = self.get_success_response(
                self.organization.slug,
                status_code=201,
                **self.alert_rule_dict,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)
        assert_alert_rule_migrated(alert_rule, self.project.id)

    @with_feature("organizations:slack-metric-alert-description")
    @with_feature("organizations:incidents")
    def test_with_description(self):
        data = {
            **self.alert_rule_dict,
            "description": "yeehaw",
        }

        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug,
                status_code=201,
                **data,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)
        assert alert_rule.description == resp.data.get("description")

    @with_feature("organizations:incidents")
    def test_invalid_threshold_type(self):
        """
        Test that a comparison alert (percent based) can't use the above and below threshold type
        """
        data = {
            **self.alert_rule_dict,
            "comparisonDelta": 10080.0,
            "thresholdType": AlertRuleThresholdType.ABOVE_AND_BELOW.value,
        }

        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug,
                status_code=400,
                **data,
            )
        assert not AlertRule.objects.filter(
            threshold_type=AlertRuleThresholdType.ABOVE_AND_BELOW.value
        ).exists()
        assert (
            "Invalid threshold type: Allowed types for comparison alerts are above OR below"
            in resp.data["nonFieldErrors"][0]
        )

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_anomaly_detection_alert(self, mock_seer_request):
        data = self.dynamic_alert_rule_dict
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "super duper bad",
                "timestamp": (two_weeks_ago + timedelta(minutes=1)).isoformat(),
                "fingerprint": ["group1"],
                "tags": {"sentry:user": self.user.email},
            },
            default_event_type=EventType.ERROR,
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "super bad",
                "timestamp": (two_weeks_ago + timedelta(days=10)).isoformat(),
                "fingerprint": ["group2"],
                "tags": {"sentry:user": self.user.email},
            },
            default_event_type=EventType.ERROR,
            project_id=self.project.id,
        )

        with outbox_runner():
            resp = self.get_success_response(
                self.organization.slug,
                status_code=201,
                **data,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)
        assert alert_rule.seasonality == resp.data.get("seasonality")
        assert alert_rule.sensitivity == resp.data.get("sensitivity")
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_anomaly_detection_alert_timeout(self, mock_seer_request):
        data = self.dynamic_alert_rule_dict
        mock_seer_request.side_effect = TimeoutError
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug,
                status_code=408,
                **data,
            )
        assert not AlertRule.objects.filter(detection_type=AlertRuleDetectionType.DYNAMIC).exists()
        assert resp.data["detail"]["message"] == "Proxied request timed out"
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_anomaly_detection_alert_max_retry(self, mock_seer_request):
        data = self.dynamic_alert_rule_dict
        mock_seer_request.side_effect = MaxRetryError(
            seer_anomaly_detection_connection_pool, SEER_ANOMALY_DETECTION_STORE_DATA_URL
        )
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug,
                status_code=408,
                **data,
            )
        assert not AlertRule.objects.filter(detection_type=AlertRuleDetectionType.DYNAMIC).exists()
        assert resp.data["detail"]["message"] == "Proxied request timed out"
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_anomaly_detection_alert_other_error(self, mock_seer_request):
        """
        Test the catch-all in case Seer returns something that we don't expect.
        """
        data = self.dynamic_alert_rule_dict
        mock_seer_request.side_effect = HTTPError
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug,
                status_code=400,
                **data,
            )
        assert not AlertRule.objects.filter(detection_type=AlertRuleDetectionType.DYNAMIC).exists()
        assert resp.data[0] == ErrorDetail(
            string="Failed to send data to Seer - cannot create alert rule.", code="invalid"
        )

        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:incidents")
    def test_anomaly_detection_alert_validation_error(self):
        data = self.dynamic_alert_rule_dict
        data["time_window"] = 10
        with outbox_runner():
            resp = self.get_error_response(
                self.organization.slug,
                status_code=400,
                **data,
            )
        assert not AlertRule.objects.filter(detection_type=AlertRuleDetectionType.DYNAMIC).exists()
        assert resp.data[0] == INVALID_TIME_WINDOW

    def test_multiple_projects(self):
        new_project = self.create_project()
        data = {**self.alert_rule_dict, "projects": [self.project.slug, new_project.slug]}
        with outbox_runner(), self.feature(["organizations:incidents"]):
            response_data = self.get_error_response(
                self.organization.slug,
                method=responses.POST,
                status_code=status.HTTP_400_BAD_REQUEST,
                **data,
            ).json()
            assert "projects" in response_data

    def test_status_filter(self):
        with (
            outbox_runner(),
            self.feature(
                [
                    "organizations:incidents",
                    "organizations:performance-view",
                ]
            ),
        ):
            data = deepcopy(self.alert_rule_dict)
            data["query"] = "is:unresolved"
            resp = self.get_success_response(
                self.organization.slug,
                status_code=201,
                **data,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)
        assert alert_rule.snuba_query is not None
        assert alert_rule.snuba_query.query == "is:unresolved"

    def test_spm_function(self):
        with (
            outbox_runner(),
            self.feature(
                [
                    "organizations:incidents",
                    "organizations:performance-view",
                    "organizations:mep-rollout-flag",
                    "organizations:dynamic-sampling",
                ]
            ),
        ):
            data = {
                "dataset": "generic_metrics",
                "eventTypes": ["transaction"],
                "aggregate": "spm()",
                "query": "span.module:db has:span.description",
                "timeWindow": 60,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "label": "critical",
                        "alertThreshold": 7000000,
                        "actions": [
                            {
                                "type": "email",
                                "targetType": "team",
                                "targetIdentifier": self.team.id,
                            }
                        ],
                    }
                ],
                "projects": [self.project.slug],
                "environment": None,
                "resolveThreshold": None,
                "thresholdType": 1,
                "owner": self.user.id,
                "name": "Insights Queries SPM Alert",
                "projectId": "1",
                "alertType": "insights_metrics",
                "monitorType": 0,
                "activationCondition": 0,
                "comparisonDelta": None,
                "queryType": 1,
            }
            resp = self.get_success_response(
                self.organization.slug,
                status_code=201,
                **data,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)
        assert alert_rule.snuba_query is not None
        assert alert_rule.snuba_query.query == "span.module:db has:span.description"
        assert alert_rule.snuba_query.aggregate == "spm()"

    def test_performance_score_function(self):
        with (
            outbox_runner(),
            self.feature(
                [
                    "organizations:incidents",
                    "organizations:performance-view",
                    "organizations:mep-rollout-flag",
                    "organizations:dynamic-sampling",
                ]
            ),
        ):
            data = {
                "dataset": "generic_metrics",
                "eventTypes": ["transaction"],
                "aggregate": "performance_score(measurements.score.fcp)",
                "query": "transaction.op:pageload",
                "timeWindow": 60,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "label": "critical",
                        "alertThreshold": 7000000,
                        "actions": [
                            {
                                "type": "email",
                                "targetType": "team",
                                "targetIdentifier": self.team.id,
                            }
                        ],
                    }
                ],
                "projects": [self.project.slug],
                "environment": None,
                "resolveThreshold": None,
                "thresholdType": 1,
                "owner": self.user.id,
                "name": "Insights Queries SPM Alert",
                "projectId": "1",
                "alertType": "insights_metrics",
                "monitorType": 0,
                "activationCondition": 0,
                "comparisonDelta": None,
                "queryType": 1,
            }
            resp = self.get_success_response(
                self.organization.slug,
                status_code=201,
                **data,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)
        assert alert_rule.snuba_query is not None
        assert alert_rule.snuba_query.query == "transaction.op:pageload"
        assert alert_rule.snuba_query.aggregate == "performance_score(measurements.score.fcp)"

    @override_settings(MAX_QUERY_SUBSCRIPTIONS_PER_ORG=1)
    def test_enforce_max_subscriptions(self):
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, status_code=201, **self.alert_rule_dict
            )
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

        with self.feature("organizations:incidents"):
            resp = self.get_error_response(self.organization.slug, **self.alert_rule_dict)
            assert resp.data[0] == "You may not exceed 1 metric alerts per organization"

    def test_sentry_app(self):
        other_org = self.create_organization(owner=self.user)
        sentry_app = self.create_sentry_app(
            name="foo", organization=other_org, is_alertable=True, verify_install=False
        )
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )

        valid_alert_rule = deepcopy(self.alert_rule_dict)
        valid_alert_rule["name"] = "ValidSentryAppTestRule"
        valid_alert_rule["triggers"][0]["actions"][0] = {
            "type": "sentry_app",
            "targetType": "sentry_app",
            "targetIdentifier": sentry_app.id,
            "sentryAppId": sentry_app.id,
        }

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, status_code=201, **valid_alert_rule
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_missing_sentry_app(self):
        # install it on another org
        other_org = self.create_organization(owner=self.user)
        sentry_app = self.create_sentry_app(
            name="foo", organization=other_org, is_alertable=True, verify_install=False
        )
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=other_org, user=self.user
        )

        valid_alert_rule = deepcopy(self.alert_rule_dict)
        valid_alert_rule["name"] = "InvalidSentryAppTestRule"
        valid_alert_rule["triggers"][0]["actions"][0] = {
            "type": "sentry_app",
            "targetType": "sentry_app",
            "targetIdentifier": sentry_app.id,
            "sentryAppId": sentry_app.id,
        }

        with self.feature("organizations:incidents"):
            self.get_error_response(self.organization.slug, status_code=400, **valid_alert_rule)

    def test_invalid_sentry_app(self):
        valid_alert_rule = deepcopy(self.alert_rule_dict)
        valid_alert_rule["name"] = "InvalidSentryAppTestRule"
        valid_alert_rule["triggers"][0]["actions"][0] = {
            "type": "sentry_app",
            "targetType": "sentry_app",
            "targetIdentifier": "invalid",
            "sentryAppId": "invalid",
        }

        with self.feature("organizations:incidents"):
            self.get_error_response(self.organization.slug, status_code=400, **valid_alert_rule)

    def test_no_config_sentry_app(self):
        sentry_app = self.create_sentry_app(is_alertable=True)
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        alert_rule = {
            **self.alert_rule_dict,
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
            self.get_success_response(self.organization.slug, status_code=201, **alert_rule)

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
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )

        sentry_app_settings = [
            {"name": "title", "value": "test title"},
            {"name": "description", "value": "test description"},
        ]

        alert_rule = {
            **self.alert_rule_dict,
            "triggers": [
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
            ],
        }

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            self.get_success_response(self.organization.slug, status_code=201, **alert_rule)

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

        alert_rule = {
            **self.alert_rule_dict,
            "triggers": [
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
            ],
        }

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_response(self.organization.slug, **alert_rule)

        assert resp.status_code == 400
        assert error_message in resp.data["sentry_app"]

    def test_no_label(self):
        rule_one_trigger_no_label = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "projects": [self.project.slug],
            "name": "OneTriggerOnlyCritical",
            "owner": self.user.id,
            "resolveThreshold": 100,
            "thresholdType": 1,
            "triggers": [
                {
                    "alertThreshold": 200,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                }
            ],
        }

        with self.feature("organizations:incidents"):
            self.get_error_response(
                self.organization.slug, status_code=400, **rule_one_trigger_no_label
            )

    def test_only_critical_trigger(self):
        rule_one_trigger_only_critical = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "projects": [self.project.slug],
            "name": "OneTriggerOnlyCritical",
            "owner": self.user.id,
            "resolveThreshold": 200,
            "thresholdType": 1,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 100,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                }
            ],
        }
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, status_code=201, **rule_one_trigger_only_critical
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_no_triggers(self):
        rule_no_triggers = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "thresholdType": AlertRuleThresholdType.ABOVE.value,
            "projects": [self.project.slug],
            "name": "JustATestRuleWithNoTriggers",
            "owner": self.user.id,
        }

        with self.feature("organizations:incidents"):
            resp = self.get_error_response(
                self.organization.slug, status_code=400, **rule_no_triggers
            )
            assert resp.data == {"triggers": ["This field is required."]}

    def test_no_critical_trigger(self):
        rule_one_trigger_only_warning = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "projects": [self.project.slug],
            "name": "JustATestRule",
            "owner": self.user.id,
            "resolveThreshold": 100,
            "thresholdType": 1,
            "triggers": [
                {
                    "label": "warning",
                    "alertThreshold": 200,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                }
            ],
        }

        with self.feature("organizations:incidents"):
            resp = self.get_error_response(
                self.organization.slug, status_code=400, **rule_one_trigger_only_warning
            )
            assert resp.data == {"nonFieldErrors": ['Trigger 1 must be labeled "critical"']}

    def test_critical_trigger_no_action(self):
        rule_one_trigger_only_critical_no_action = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "projects": [self.project.slug],
            "name": "JustATestRule",
            "owner": self.user.id,
            "resolveThreshold": 100,
            "thresholdType": 1,
            "triggers": [{"label": "critical", "alertThreshold": 75}],
        }

        with self.feature("organizations:incidents"):
            resp = self.get_error_response(
                self.organization.slug, status_code=400, **rule_one_trigger_only_critical_no_action
            )
        assert resp.data == {
            "nonFieldErrors": [
                "Each trigger must have an associated action for this alert to fire."
            ]
        }

    def test_critical_trigger_action_no_target_id(self):
        rule_one_trigger_no_target_id = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "projects": [self.project.slug],
            "name": "OneTriggerOnlyCritical",
            "owner": self.user.id,
            "resolveThreshold": 200,
            "thresholdType": 1,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 100,
                    "actions": [{"type": "email", "targetType": "team", "targetIdentifier": ""}],
                }
            ],
        }

        with self.feature("organizations:incidents"):
            resp = self.get_error_response(
                self.organization.slug, status_code=400, **rule_one_trigger_no_target_id
            )
        assert resp.data[0] == ErrorDetail(
            string="One or more of your actions is missing a target identifier.", code="invalid"
        )

    def test_invalid_projects(self):
        with self.feature("organizations:incidents"):
            resp = self.get_error_response(
                self.organization.slug,
                status_code=400,
                projects=[
                    self.project.slug,
                    self.create_project(organization=self.create_organization()).slug,
                ],
                name="an alert",
                owner=self.user.id,
                thresholdType=1,
                query="hi",
                aggregate="count()",
                timeWindow=10,
                alertThreshold=1000,
                resolveThreshold=100,
                triggers=[
                    {
                        "label": "critical",
                        "alertThreshold": 200,
                        "actions": [
                            {
                                "type": "email",
                                "targetType": "team",
                                "targetIdentifier": self.team.id,
                            }
                        ],
                    }
                ],
            )
            assert resp.json() == {"projects": ["Invalid project"]}

    def test_no_feature(self):
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404

    def test_no_perms(self):
        with (
            assume_test_silo_mode(SiloMode.REGION),
            outbox_context(transaction.atomic(using=router.db_for_write(OrganizationMember))),
        ):
            OrganizationMember.objects.filter(user_id=self.user.id).update(role="member")
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, **self.alert_rule_dict)
        assert resp.status_code == 201

        member_user = self.create_user()
        self.create_member(
            user=member_user, organization=self.organization, role="member", teams=[self.team]
        )
        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(member_user)
        resp = self.get_response(self.organization.slug, **self.alert_rule_dict)
        assert resp.status_code == 403

        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, **self.alert_rule_dict)
        assert resp.status_code == 403

    def test_team_admin_create(self):
        team_admin_user = self.create_user()
        self.create_member(
            team_roles=[(self.team, "admin")],
            user=team_admin_user,
            role="member",
            organization=self.organization,
        )

        member_user = self.create_user()
        self.create_member(
            user=member_user, organization=self.organization, role="member", teams=[self.team]
        )

        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(team_admin_user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, **self.alert_rule_dict)
        assert resp.status_code == 201

        # verify that a team admin cannot create an alert for a project their team doesn't own
        with self.feature("organizations:incidents"):
            resp = self.get_error_response(
                self.organization.slug,
                status_code=400,
                projects=[
                    self.create_project(organization=self.create_organization()).slug,
                ],
                name="an alert",
                owner=team_admin_user.id,
                thresholdType=1,
                query="hi",
                aggregate="count()",
                timeWindow=10,
                alertThreshold=1000,
                resolveThreshold=100,
                triggers=[
                    {
                        "label": "critical",
                        "alertThreshold": 200,
                        "actions": [
                            {
                                "type": "email",
                                "targetType": "team",
                                "targetIdentifier": self.team.id,
                            }
                        ],
                    }
                ],
            )
            assert resp.json() == {"projects": ["Invalid project"]}

        # verify that a regular team member cannot create an alert
        self.login_as(member_user)
        resp = self.get_response(self.organization.slug, **self.alert_rule_dict)
        assert resp.status_code == 403

    def test_member_create(self):
        member_user = self.create_user()
        self.create_member(
            user=member_user, organization=self.organization, role="member", teams=[self.team]
        )
        self.organization.update_option("sentry:alerts_member_write", True)
        self.login_as(member_user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, **self.alert_rule_dict)
        assert resp.status_code == 201

    def test_no_owner(self):
        self.login_as(self.user)
        rule_data = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "projects": [self.project.slug],
            "name": "JustATestRule",
            "resolveThreshold": 100,
            "thresholdType": 1,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 75,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                }
            ],
        }

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, status_code=201, **rule_data)
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, True),
    )
    @patch.object(find_channel_id_for_alert_rule, "apply_async")
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_kicks_off_slack_async_job(
        self, mock_uuid4, mock_find_channel_id_for_alert_rule, mock_get_channel_id
    ):
        mock_uuid4.return_value = self.get_mock_uuid()
        valid_alert_rule = {
            **self.alert_rule_dict,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 200,
                    "actions": self.slack_action,
                },
            ],
        }
        with self.feature(["organizations:incidents"]):
            resp = self.get_success_response(
                self.organization.slug, status_code=202, **valid_alert_rule
            )
        assert resp.data["uuid"] == "abc123"
        assert not AlertRule.objects.filter(name="JustAValidTestRule").exists()
        kwargs = {
            "organization_id": self.organization.id,
            "uuid": "abc123",
            "data": valid_alert_rule,
            "user_id": self.user.id,
        }
        mock_find_channel_id_for_alert_rule.assert_called_once_with(kwargs=kwargs)

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        side_effect=[
            SlackChannelIdData("#", "10", False),
            SlackChannelIdData("#", "10", False),
            SlackChannelIdData("#", "20", False),
        ],
    )
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_async_lookup_outside_transaction(self, mock_uuid4, mock_get_channel_id):
        mock_uuid4.return_value = self.get_mock_uuid()
        name = "MySpecialAsyncTestRule"
        test_params = {
            **self.alert_rule_dict,
            "name": name,
            "thresholdType": 1,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 75,
                    "actions": self.slack_action,
                },
            ],
        }

        with self.feature("organizations:incidents"), self.tasks():
            resp = self.get_response(self.organization.slug, **test_params)
        assert resp.data["uuid"] == "abc123"
        assert mock_get_channel_id.call_count == 1
        # Using get deliberately as there should only be one. Test should fail otherwise.
        alert_rule = AlertRule.objects.get(name=name)
        trigger = AlertRuleTrigger.objects.get(alert_rule_id=alert_rule.id)
        action = AlertRuleTriggerAction.objects.get(alert_rule_trigger=trigger)
        assert action.target_identifier == "10"
        assert action.target_display == "my-channel"

        # Now two actions with slack:
        name = "MySpecialAsyncTestRuleTakeTwo"
        test_params["name"] = name
        test_params["triggers"] = [
            {
                "label": "critical",
                "alertThreshold": 75,
                "actions": [
                    {
                        "type": "slack",
                        "targetIdentifier": "my-channel",
                        "targetType": "specific",
                        "integrationId": self.integration.id,
                    },
                    {
                        "type": "slack",
                        "targetIdentifier": "another-channel",
                        "targetType": "specific",
                        "integrationId": self.integration.id,
                    },
                ],
            },
        ]
        with self.feature("organizations:incidents"), self.tasks():
            resp = self.get_response(self.organization.slug, **test_params)
        assert resp.data["uuid"] == "abc123"
        assert (
            mock_get_channel_id.call_count == 3
        )  # just made 2 calls, plus the call from the single action test
        # Using get deliberately as there should only be one. Test should fail otherwise.
        alert_rule = AlertRule.objects.get(name=name)

        trigger = AlertRuleTrigger.objects.get(alert_rule_id=alert_rule.id)
        actions = AlertRuleTriggerAction.objects.filter(alert_rule_trigger=trigger).order_by("id")
        assert actions[0].target_identifier == "10"
        assert actions[0].target_display == "my-channel"
        assert actions[1].target_identifier == "20"
        assert actions[1].target_display == "another-channel"

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
            resp = self.get_response(self.organization.slug, **test_params)
        assert resp.status_code == 400
        # Did not increment from the last assertion because we early out on the validation error
        assert mock_get_channel_id.call_count == 3

    def test_performance_dataset(self):
        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:mep-rollout-flag",
                "organizations:dynamic-sampling",
            ]
        ):
            test_params = {**self.alert_rule_dict, "dataset": "generic_metrics"}

            resp = self.get_success_response(
                self.organization.slug,
                status_code=201,
                **test_params,
            )

            assert "id" in resp.data
            alert_rule = AlertRule.objects.get(id=resp.data["id"])
            assert resp.data == serialize(alert_rule, self.user)

            test_params = {**self.alert_rule_dict, "dataset": "transactions"}

            resp = self.get_error_response(
                self.organization.slug,
                status_code=400,
                **test_params,
            )

            assert (
                resp.data["dataset"][0]
                == "Performance alerts must use the `generic_metrics` dataset"
            )

    def test_alert_with_metrics_layer(self):
        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:mep-rollout-flag",
                "organizations:dynamic-sampling",
                "organizations:custom-metrics",
            ]
        ):
            for mri in (
                "count()",
                "avg(transaction.duration)",
                "apdex()",
                "failure_rate()",
                "p90(transaction.duration)",
            ):
                test_params = {
                    **self.alert_rule_dict,
                    "aggregate": mri,
                    "dataset": "generic_metrics",
                }

                resp = self.get_success_response(
                    self.organization.slug,
                    status_code=201,
                    **test_params,
                )

                assert "id" in resp.data
                alert_rule = AlertRule.objects.get(id=resp.data["id"])
                assert resp.data == serialize(alert_rule, self.user)

    def test_alert_with_metric_mri(self):
        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:mep-rollout-flag",
                "organizations:dynamic-sampling",
                "organizations:custom-metrics",
            ]
        ):
            for mri in (
                "sum(c:transactions/count_per_root_project@none)",
                "p90(d:transactions/duration@millisecond)",
                "p95(d:transactions/duration@millisecond)",
                "count_unique(s:transactions/user@none)",
                "avg(d:custom/sentry.process_profile.symbolicate.process@second)",
            ):
                test_params = {
                    **self.alert_rule_dict,
                    "aggregate": mri,
                    "dataset": "generic_metrics",
                }

                resp = self.get_success_response(
                    self.organization.slug,
                    status_code=201,
                    **test_params,
                )

                assert "id" in resp.data
                alert_rule = AlertRule.objects.get(id=resp.data["id"])
                assert resp.data == serialize(alert_rule, self.user)

    def test_alert_with_metric_mri_on_wrong_dataset(self):
        with self.feature(
            [
                "organizations:incidents",
                "organizations:performance-view",
                "organizations:mep-rollout-flag",
                "organizations:dynamic-sampling",
                "organizations:custom-metrics",
            ]
        ):
            test_params = {
                **self.alert_rule_dict,
                "aggregate": "sum(c:sessions/session@none)",
                "dataset": "metrics",
            }

            resp = self.get_error_response(
                self.organization.slug,
                status_code=400,
                **test_params,
            )

            assert (
                resp.data["nonFieldErrors"][0]
                == "You can use an MRI only on alerts on performance metrics"
            )

    def test_post_rule_256_char_name(self):
        char_256_name = "wOOFmsWY80o0RPrlsrrqDp2Ylpr5K2unBWbsrqvuNb4Fy3vzawkNAyFJdqeFLlXNWF2kMfgMT9EQmFF3u3MqW3CTI7L2SLsmS9uSDQtcinjlZrr8BT4v8Q6ySrVY5HmiFO97w3awe4lA8uyVikeaSwPjt8MD5WSjdTI0RRXYeK3qnHTpVswBe9AIcQVMLKQXHgjulpsrxHc0DI0Vb8hKA4BhmzQXhYmAvKK26ZwCSjJurAODJB6mgIdlV7tigsFO"
        alert_rule_dict = self.alert_rule_dict
        alert_rule_dict["name"] = char_256_name
        with (
            outbox_runner(),
            self.feature(["organizations:incidents", "organizations:performance-view"]),
        ):
            resp = self.get_success_response(
                self.organization.slug,
                status_code=201,
                **alert_rule_dict,
            )
        rule = AlertRule.objects.get(id=resp.data["id"])
        assert rule.name == char_256_name

    def test_post_rule_over_256_char_name(self):
        char_257_name = "wOOFmsWY80o0RPrlsrrqDp2Ylpr5K2unBWbsrqvuNb4Fy3vzawkNAyFJdqeFLlXNWF2kMfgMT9EQmFF3u3MqW3CTI7L2SLsmS9uSDQtcinjlZrr8BT4v8Q6ySrVY5HmiFO97w3awe4lA8uyVikeaSwPjt8MD5WSjdTI0RRXYeK3qnHTpVswBe9AIcQVMLKQXHgjulpsrxHc0DI0Vb8hKA4BhmzQXhYmAvKK26ZwCSjJurAODJB6mgIdlV7tigsFOK"
        alert_rule_dict = self.alert_rule_dict
        alert_rule_dict["name"] = char_257_name
        with (
            outbox_runner(),
            self.feature(["organizations:incidents", "organizations:performance-view"]),
        ):
            resp = self.get_error_response(
                self.organization.slug, status_code=400, **alert_rule_dict
            )
        assert resp.data["name"][0] == "Ensure this field has no more than 256 characters."

    @patch("sentry.analytics.record")
    def test_performance_alert(self, record_analytics):
        valid_alert_rule = {
            **self.alert_rule_dict,
            "queryType": 1,
            "dataset": "transactions",
            "eventTypes": ["transaction"],
        }
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_response(self.organization.slug, **valid_alert_rule)
            assert resp.status_code == 201


@freeze_time()
class AlertRuleCreateEndpointTestCrashRateAlert(AlertRuleIndexBase):
    method = "post"

    def setUp(self):
        super().setUp()
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        self.valid_alert_rule = {
            "aggregate": "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            "query": "",
            "timeWindow": "60",
            "resolveThreshold": 90,
            "thresholdType": 1,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 70,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                },
                {
                    "label": "warning",
                    "alertThreshold": 80,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                        {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                    ],
                },
            ],
            "projects": [self.project.slug],
            "owner": self.user.id,
            "name": "JustAValidTestRule",
            "dataset": "metrics",
            "eventTypes": [],
        }

    def test_simple_crash_rate_alerts_for_sessions(self):
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(
                self.organization.slug, status_code=201, **self.valid_alert_rule
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_simple_crash_rate_alerts_for_users(self):
        self.valid_alert_rule.update(
            {
                "aggregate": "percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
            }
        )
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(
                self.organization.slug, status_code=201, **self.valid_alert_rule
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_simple_crash_rate_alerts_for_sessions_drops_event_types(self):
        self.valid_alert_rule["eventTypes"] = ["error"]
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(
                self.organization.slug, status_code=201, **self.valid_alert_rule
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

    def test_simple_crash_rate_alerts_for_sessions_with_invalid_time_window(self):
        self.valid_alert_rule["timeWindow"] = "90"
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_error_response(
                self.organization.slug, status_code=400, **self.valid_alert_rule
            )
        assert (
            resp.data["nonFieldErrors"][0]
            == "Invalid Time Window: Allowed time windows for crash rate alerts are: "
            "30min, 1h, 2h, 4h, 12h and 24h"
        )

    def test_simple_crash_rate_alerts_for_non_supported_aggregate(self):
        self.valid_alert_rule.update({"aggregate": "count(sessions)"})
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_error_response(
                self.organization.slug, status_code=400, **self.valid_alert_rule
            )
        assert (
            resp.data["nonFieldErrors"][0]
            == "Only crash free percentage queries are supported for crash rate alerts"
        )

    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, True),
    )
    @patch.object(find_channel_id_for_alert_rule, "apply_async")
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_crash_rate_alerts_kicks_off_slack_async_job(
        self, mock_uuid4, mock_find_channel_id_for_alert_rule, mock_get_channel_id
    ):
        mock_uuid4.return_value = self.get_mock_uuid()
        self.valid_alert_rule["triggers"] = [
            {
                "label": "critical",
                "alertThreshold": 50,
                "actions": self.slack_action,
            },
        ]
        with self.feature(["organizations:incidents"]):
            resp = self.get_success_response(
                self.organization.slug, status_code=202, **self.valid_alert_rule
            )
        assert resp.data["uuid"] == "abc123"
        assert not AlertRule.objects.filter(name="JustAValidTestRule").exists()
        kwargs = {
            "organization_id": self.organization.id,
            "uuid": "abc123",
            "data": self.valid_alert_rule,
            "user_id": self.user.id,
        }
        mock_find_channel_id_for_alert_rule.assert_called_once_with(kwargs=kwargs)


@freeze_time()
class MetricsCrashRateAlertCreationTest(AlertRuleCreateEndpointTestCrashRateAlert):
    method = "post"

    def setUp(self):
        super().setUp()
        self.valid_alert_rule["dataset"] = Dataset.Metrics.value
        for tag in [
            SessionMRI.RAW_SESSION.value,
            SessionMRI.RAW_USER.value,
            "session.status",
            "init",
            "crashed",
        ]:
            indexer.record(use_case_id=UseCaseID.SESSIONS, org_id=self.organization.id, string=tag)
