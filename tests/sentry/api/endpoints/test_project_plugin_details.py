from unittest import mock

from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.options.project_option import ProjectOption
from sentry.plugins.base import plugins
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode


class ProjectPluginDetailsTestBase(APITestCase):
    endpoint = "sentry-api-0-project-plugin-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not AuditLogEntry.objects.filter(target_object=self.project.id).exists()


class ProjectPluginDetailsTest(ProjectPluginDetailsTestBase):
    def test_simple(self):
        response = self.get_success_response(
            self.project.organization.slug, self.project.slug, "webhooks"
        )
        assert response.data["id"] == "webhooks"
        assert response.data["config"] == [
            {
                "choices": None,
                "defaultValue": None,
                "help": "Enter callback URLs to POST new events to (one per line).",
                "isDeprecated": False,
                "isHidden": False,
                "label": "Callback URLs",
                "name": "urls",
                "placeholder": "https://sentry.io/callback/url",
                "readonly": False,
                "required": False,
                "type": "textarea",
                "value": None,
            }
        ]

    def test_auth_url_absolute(self):
        response = self.get_success_response(
            self.project.organization.slug, self.project.slug, "asana"
        )
        assert response.data["id"] == "asana"
        assert "http://testserver" in response.data["auth_url"]
        assert "social/associate/asana" in response.data["auth_url"]


class UpdateProjectPluginTest(ProjectPluginDetailsTestBase):
    method = "put"

    def test_simple(self):
        with outbox_runner():
            self.get_success_response(
                self.project.organization.slug,
                self.project.slug,
                "webhooks",
                **{"urls": "http://example.com/foo"},
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit = AuditLogEntry.objects.get(target_object=self.project.id)
        assert audit.event == 111
        assert (
            ProjectOption.objects.get(key="webhooks:urls", project=self.project).value
            == "http://example.com/foo"
        )


class EnableProjectPluginTest(ProjectPluginDetailsTestBase):
    method = "post"

    @mock.patch.object(NotificationPlugin, "test_configuration", side_effect="test_configuration")
    def test_simple(self, test_configuration):
        plugins.get("webhooks").disable(self.project)

        with outbox_runner():
            self.get_success_response(self.project.organization.slug, self.project.slug, "webhooks")

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit = AuditLogEntry.objects.get(target_object=self.project.id)
        assert audit.event == 110
        assert ProjectOption.objects.get(key="webhooks:enabled", project=self.project).value is True
        with assume_test_silo_mode(SiloMode.CONTROL):
            audit.delete()

        # Testing the Plugin
        self.get_success_response(
            self.project.organization.slug, self.project.slug, "webhooks", **{"test": True}
        )
        test_configuration.assert_called_once_with(self.project)

        # Reset the plugin
        with outbox_runner():
            response = self.get_success_response(
                self.project.organization.slug, self.project.slug, "webhooks", **{"reset": True}
            )
        with assume_test_silo_mode(SiloMode.CONTROL):
            audit = AuditLogEntry.objects.get(target_object=self.project.id)
        test_configuration.assert_called_once_with(self.project)
        assert audit.event == 111

        configs = response.data.get("config")

        for config in configs:
            assert config.get("value") is None

    @with_feature("organizations:data-forwarding")
    def test_allow_plugin_with_feature_enabled(self):
        self.get_success_response(self.organization.slug, self.project.slug, "amazon-sqs")

    @with_feature({"organizations:data-forwarding": False})
    def test_disallow_plugin_with_feature_disabled(self):
        self.get_error_response(
            self.organization.slug, self.project.slug, "amazon-sqs", status_code=403
        )


class DisableProjectPluginTest(ProjectPluginDetailsTestBase):
    method = "delete"

    def test_simple(self):
        plugins.get("webhooks").enable(self.project)

        with outbox_runner():
            self.get_success_response(self.project.organization.slug, self.project.slug, "webhooks")

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit = AuditLogEntry.objects.get(target_object=self.project.id)
        assert audit.event == 112
        assert (
            ProjectOption.objects.get(key="webhooks:enabled", project=self.project).value is False
        )
