from copy import deepcopy
from functools import cached_property

from django.db import router
from freezegun import freeze_time

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.incidents.models import AlertRule, AlertRuleThresholdType
from sentry.models import AuditLogEntry
from sentry.models.organizationmember import OrganizationMember
from sentry.silo import SiloMode, unguarded_write
from sentry.snuba.models import SnubaQueryEventType
from sentry.testutils import APITestCase
from sentry.testutils.silo import assume_test_silo_mode


class AlertRuleBase:
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
            "projects": [self.project.slug],
            "name": "JustAValidTestRule",
            "owner": self.user.id,
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
            "event_types": [SnubaQueryEventType.EventType.ERROR.name.lower()],
        }


class AlertRuleIndexBase(AlertRuleBase):
    endpoint = "sentry-api-0-organization-alert-rules"


class AlertRuleListEndpointTest(AlertRuleIndexBase, APITestCase):
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


@freeze_time()
class AlertRuleCreateEndpointTest(AlertRuleIndexBase, APITestCase):
    method = "post"

    @assume_test_silo_mode(SiloMode.CONTROL)
    def setUp(self):
        super(AlertRuleBase, self).setUp()

        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

    def test_simple(self):
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(
                self.organization.slug, status_code=201, **deepcopy(self.alert_rule_dict)
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

        audit_log_entry = AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("ALERT_RULE_ADD"), target_object=alert_rule.id
        )
        assert len(audit_log_entry) == 1

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
            resp = self.get_success_response(
                self.organization.slug, status_code=201, **rule_one_trigger_only_critical_no_action
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

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
        # Downgrade user from "owner" to "member".
        with unguarded_write(using=router.db_for_write(OrganizationMember)):
            OrganizationMember.objects.filter(user_id=self.user.id).update(role="member")

        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 403

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
            "triggers": [{"label": "critical", "alertThreshold": 75}],
        }

        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, status_code=201, **rule_data)
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)
