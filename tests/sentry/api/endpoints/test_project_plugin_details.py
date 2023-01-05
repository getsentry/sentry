from unittest import mock

from sentry.models import AuditLogEntry, ProjectOption
from sentry.plugins.base import plugins
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


class ProjectPluginDetailsTestBase(APITestCase):
    endpoint = "sentry-api-0-project-plugin-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        assert not AuditLogEntry.objects.filter(target_object=self.project.id).exists()


@region_silo_test(stable=True)
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


@region_silo_test(stable=True)
class UpdateProjectPluginTest(ProjectPluginDetailsTestBase):
    method = "put"

    def test_simple(self):
        self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            "webhooks",
            **{"urls": "http://example.com/foo"},
        )

        self.assert_audit_log_created(self.user, 111, self.project.id, self.project.organization)
        assert (
            ProjectOption.objects.get(key="webhooks:urls", project=self.project).value
            == "http://example.com/foo"
        )


@region_silo_test(stable=True)
class EnableProjectPluginTest(ProjectPluginDetailsTestBase):
    method = "post"

    @mock.patch.object(NotificationPlugin, "test_configuration", side_effect="test_configuration")
    def test_simple(self, test_configuration):
        plugins.get("webhooks").disable(self.project)

        self.get_success_response(self.project.organization.slug, self.project.slug, "webhooks")

        self.assert_audit_log_created(self.user, 110, self.project.id, self.project.organization)
        assert ProjectOption.objects.get(key="webhooks:enabled", project=self.project).value is True

        # Testing the Plugin
        self.get_success_response(
            self.project.organization.slug, self.project.slug, "webhooks", **{"test": True}
        )
        test_configuration.assert_called_once_with(self.project)

        # Reset the plugin
        response = self.get_success_response(
            self.project.organization.slug, self.project.slug, "webhooks", **{"reset": True}
        )
        self.assert_audit_log_created(self.user, 111, self.project.id, self.project.organization)
        test_configuration.assert_called_once_with(self.project)

        configs = response.data.get("config")

        for config in configs:
            assert config.get("value") is None


@region_silo_test(stable=True)
class DisableProjectPluginTest(ProjectPluginDetailsTestBase):
    method = "delete"

    def test_simple(self):
        plugins.get("webhooks").enable(self.project)

        self.get_success_response(self.project.organization.slug, self.project.slug, "webhooks")

        self.assert_audit_log_created(self.user, 112, self.project.id, self.project.organization)
        assert (
            ProjectOption.objects.get(key="webhooks:enabled", project=self.project).value is False
        )
