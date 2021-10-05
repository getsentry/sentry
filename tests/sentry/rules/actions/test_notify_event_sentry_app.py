from sentry.rules.actions.notify_event_sentry_app import NotifyEventSentryAppAction
from sentry.tasks.sentry_apps import notify_sentry_app
from sentry.testutils.cases import RuleTestCase

SENTRY_APP_ALERT_ACTION = "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction"


class NotifyEventSentryAppActionTest(RuleTestCase):
    rule_cls = NotifyEventSentryAppAction
    schema = {
        "elements": [
            {
                "type": "alert-rule-action",
                "title": "Create Alert Rule UI Example Task",
                "settings": {
                    "type": "alert-rule-settings",
                    "uri": "/test/",
                    "required_fields": [
                        {"type": "text", "label": "Title", "name": "title"},
                        {"type": "textarea", "label": "Description", "name": "description"},
                    ],
                },
            }
        ]
    }
    schema_data = {"title": "foo", "description": "bar"}

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

    def test_sentry_app_actions(self):
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
