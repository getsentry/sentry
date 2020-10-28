from __future__ import absolute_import

from sentry.utils.compat import mock
from django.core.urlresolvers import reverse

from sentry.plugins.base import plugins
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.models import ProjectOption, AuditLogEntry
from sentry.testutils import APITestCase


class ProjectPluginDetailsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-plugin-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "plugin_id": "webhooks",
            },
        )
        response = self.client.get(url)
        assert response.status_code == 200, (response.status_code, response.content)
        assert response.data["id"] == "webhooks"
        assert response.data["config"] == [
            {
                "readonly": False,
                "choices": None,
                "placeholder": "https://sentry.io/callback/url",
                "name": "urls",
                "help": "Enter callback URLs to POST new events to (one per line).",
                "defaultValue": None,
                "required": False,
                "type": "textarea",
                "value": None,
                "label": "Callback URLs",
            }
        ]


class UpdateProjectPluginTest(APITestCase):
    def test_simple(self):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-plugin-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "plugin_id": "webhooks",
            },
        )
        audit = AuditLogEntry.objects.filter(target_object=project.id)

        assert not audit

        response = self.client.put(url, data={"urls": "http://example.com/foo"})
        audit = AuditLogEntry.objects.get(target_object=project.id)

        assert audit.event == 111
        assert response.status_code == 200, (response.status_code, response.content)
        assert (
            ProjectOption.objects.get(key="webhooks:urls", project=project).value
            == "http://example.com/foo"
        )


class EnableProjectPluginTest(APITestCase):
    @mock.patch.object(NotificationPlugin, "test_configuration", side_effect="test_configuration")
    def test_simple(self, test_configuration):
        project = self.create_project()

        self.login_as(user=self.user)

        plugins.get("webhooks").disable(project)

        url = reverse(
            "sentry-api-0-project-plugin-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "plugin_id": "webhooks",
            },
        )
        audit = AuditLogEntry.objects.filter(target_object=project.id)

        assert not audit

        response = self.client.post(url)
        audit = AuditLogEntry.objects.get(target_object=project.id)

        assert audit.event == 110
        assert response.status_code == 201, (response.status_code, response.content)
        assert ProjectOption.objects.get(key="webhooks:enabled", project=project).value is True
        audit.delete()

        # Testing the Plugin
        response = self.client.post(url, {"test": True})
        test_configuration.assert_called_once_with(project)
        assert response.status_code == 200, (response.status_code, response.content)

        # Reset the plugin
        response = self.client.post(url, {"reset": True})
        audit = AuditLogEntry.objects.get(target_object=project.id)
        test_configuration.assert_called_once_with(project)
        assert audit.event == 111
        assert response.status_code == 200, (response.status_code, response.content)

        configs = response.data.get("config")

        for config in configs:
            assert config.get("value") is None


class DisableProjectPluginTest(APITestCase):
    def test_simple(self):
        project = self.create_project()

        self.login_as(user=self.user)

        plugins.get("webhooks").enable(project)

        url = reverse(
            "sentry-api-0-project-plugin-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "plugin_id": "webhooks",
            },
        )
        audit = AuditLogEntry.objects.filter(target_object=project.id)

        assert not audit

        response = self.client.delete(url)
        audit = AuditLogEntry.objects.get(target_object=project.id)

        assert audit.event == 112
        assert response.status_code == 204, (response.status_code, response.content)
        assert ProjectOption.objects.get(key="webhooks:enabled", project=project).value is False
