from __future__ import annotations

import responses

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleSerializer
from sentry.incidents.models import AlertRule
from sentry.models import AuditLogEntry
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


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


@region_silo_test(stable=True)
class AlertRuleDetailsGetEndpointTest(AlertRuleDetailsBase):
    def test_simple(self):
        self.login_as(self.member_user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, self.project.slug, self.alert_rule.id
            )

        assert resp.data == serialize(self.alert_rule, serializer=DetailedAlertRuleSerializer())


class AlertRuleDetailsPutEndpointTest(AlertRuleDetailsBase):
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(self.owner_user)

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
