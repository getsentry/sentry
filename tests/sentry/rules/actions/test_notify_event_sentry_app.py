from unittest.mock import patch

import pytest
from rest_framework import serializers

from sentry.rules.actions.sentry_apps import NotifyEventSentryAppAction
from sentry.silo import SiloMode
from sentry.tasks.sentry_apps import notify_sentry_app
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]

ValidationError = serializers.ValidationError
SENTRY_APP_ALERT_ACTION = "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction"


@region_silo_test
class NotifyEventSentryAppActionTest(RuleTestCase):
    rule_cls = NotifyEventSentryAppAction
    schema_data = [
        {"name": "title", "value": "Squid Game"},
        {"name": "summary", "value": "circle triangle square"},
    ]

    @pytest.fixture(autouse=True)
    def create_schema(self):
        self.schema = {"elements": [self.create_alert_rule_action_schema()]}

    def test_applies_correctly_for_sentry_apps(self):
        event = self.get_event()

        self.app = self.create_sentry_app(
            organization=event.organization,
            name="Test Application",
            is_alertable=True,
            schema=self.schema,
        )

        self.install = self.create_sentry_app_installation(
            slug="test-application", organization=event.organization
        )

        rule = self.get_rule(
            data={
                "sentryAppInstallationUuid": self.install.uuid,
                "settings": self.schema_data,
            }
        )

        assert rule.id == SENTRY_APP_ALERT_ACTION

        futures = list(rule.after(event=event, state=self.get_state()))
        assert len(futures) == 1
        assert futures[0].callback is notify_sentry_app
        assert futures[0].kwargs["sentry_app"].id == self.app.id
        assert futures[0].kwargs["schema_defined_settings"] == self.schema_data

    @patch("sentry.sentry_apps.SentryAppComponentPreparer.run")
    def test_sentry_app_actions(self, mock_sentry_app_component_preparer):
        event = self.get_event()

        self.project = self.create_project(organization=event.organization)

        self.app = self.create_sentry_app(
            organization=event.organization,
            name="Test Application",
            is_alertable=True,
            schema=self.schema,
        )

        self.install = self.create_sentry_app_installation(
            slug="test-application", organization=event.organization
        )

        rule = self.get_rule(
            data={
                "sentryAppInstallationUuid": self.install.uuid,
                "settings": self.schema_data,
            }
        )

        action_list = rule.get_custom_actions(self.project)
        assert len(action_list) == 1

        action = action_list[0]
        alert_element = self.schema["elements"][0]
        assert action["id"] == SENTRY_APP_ALERT_ACTION
        assert action["service"] == self.app.slug
        assert action["prompt"] == self.app.name
        assert action["actionType"] == "sentryapp"
        assert action["enabled"]
        assert action["formFields"] == alert_element["settings"]
        assert alert_element["title"] in action["label"]

    def test_self_validate(self):
        self.organization = self.create_organization()
        self.app = self.create_sentry_app(
            organization=self.organization,
            name="Test Application",
            is_alertable=True,
            schema=self.schema,
        )
        self.install = self.create_sentry_app_installation(
            slug="test-application", organization=self.organization
        )

        # Test no Sentry App Installation uuid
        rule = self.get_rule(data={"hasSchemaFormConfig": True})
        with pytest.raises(ValidationError):
            rule.self_validate()

        # Test invalid Sentry App Installation uuid
        rule = self.get_rule(
            data={"hasSchemaFormConfig": True, "sentryAppInstallationUuid": "not_a_real_uuid"}
        )
        with pytest.raises(ValidationError):
            rule.self_validate()

        # Test deleted Sentry App Installation uuid
        test_install = self.create_sentry_app_installation(
            organization=self.organization, slug="test-application"
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            test_install.delete()
        rule = self.get_rule(
            data={"hasSchemaFormConfig": True, "sentryAppInstallationUuid": test_install.uuid}
        )
        with pytest.raises(ValidationError):
            rule.self_validate()

        # Test Sentry Apps without alert rules configured in their schema
        self.create_sentry_app(organization=self.organization, name="No Alert Rule Action")
        test_install = self.create_sentry_app_installation(
            organization=self.organization, slug="no-alert-rule-action"
        )
        rule = self.get_rule(
            data={"hasSchemaFormConfig": True, "sentryAppInstallationUuid": test_install.uuid}
        )
        with pytest.raises(ValidationError):
            rule.self_validate()

        # Test without providing settings in rule data
        rule = self.get_rule(
            data={"hasSchemaFormConfig": True, "sentryAppInstallationUuid": self.install.uuid}
        )
        with pytest.raises(ValidationError):
            rule.self_validate()

        # Test without providing required field values
        rule = self.get_rule(
            data={
                "hasSchemaFormConfig": True,
                "sentryAppInstallationUuid": self.install.uuid,
                "settings": [{"name": "title", "value": "Lamy"}],
            }
        )
        with pytest.raises(ValidationError):
            rule.self_validate()

        # Test with additional fields not on the app's schema
        rule = self.get_rule(
            data={
                "hasSchemaFormConfig": True,
                "sentryAppInstallationUuid": self.install.uuid,
                "settings": [
                    {"name": "title", "value": "Lamy"},
                    {"name": "summary", "value": "Safari"},
                    {"name": "invalidField", "value": "Invalid Value"},
                ],
            }
        )
        with pytest.raises(ValidationError):
            rule.self_validate()

        # Test with invalid value on Select field
        rule = self.get_rule(
            data={
                "hasSchemaFormConfig": True,
                "sentryAppInstallationUuid": self.install.uuid,
                "settings": [
                    {"name": "title", "value": "Lamy"},
                    {"name": "summary", "value": "Safari"},
                    {"name": "points", "value": "Invalid Select Value"},
                ],
            }
        )
        with pytest.raises(ValidationError):
            rule.self_validate()

    def test_render_label(self):
        event = self.get_event()

        self.app = self.create_sentry_app(
            organization=event.organization,
            name="Test Application",
            is_alertable=True,
            schema=self.schema,
        )

        self.install = self.create_sentry_app_installation(
            slug="test-application", organization=event.organization
        )

        rule = self.get_rule(
            data={
                "sentryAppInstallationUuid": self.install.uuid,
                "settings": self.schema_data,
            }
        )

        assert rule.render_label() == "Create Task with App"
