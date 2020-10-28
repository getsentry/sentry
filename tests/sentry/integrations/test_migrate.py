from __future__ import absolute_import

from sentry.integrations.example import ExampleIntegrationProvider
from sentry.mediators.plugins import Migrator
from sentry.models import Integration, Repository
from sentry.plugins.base import plugins
from sentry.plugins.bases.issue2 import IssuePlugin2
from sentry.testutils import TestCase


class ExamplePlugin(IssuePlugin2):
    slug = "example"


plugins.register(ExamplePlugin)


class MigratorTest(TestCase):
    def setUp(self):
        super(MigratorTest, self).setUp()

        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)

        self.integration = Integration.objects.create(provider=ExampleIntegrationProvider.key)

        self.migrator = Migrator(integration=self.integration, organization=self.organization)

    def test_all_repos_migrated(self):
        Repository.objects.create(
            organization_id=self.organization.id,
            provider=self.integration.provider,
            integration_id=self.integration.id,
        )

        assert self.migrator.all_repos_migrated(self.integration.provider)

    def test_disable_for_all_projects(self):
        plugin = plugins.get("example")
        plugin.enable(self.project)

        assert plugin in plugins.for_project(self.project)

        self.migrator.disable_for_all_projects(plugin)

        assert plugin not in plugins.for_project(self.project)

    def test_call(self):
        plugin = plugins.get("example")
        plugin.enable(self.project)

        self.migrator.call()
        assert plugin not in plugins.for_project(self.project)

    def test_does_not_disable_any_plugin(self):
        plugin = plugins.get("webhooks")
        plugin.enable(self.project)

        self.migrator.call()
        assert plugin in plugins.for_project(self.project)

    def test_logs(self):
        Migrator.run(integration=self.integration, organization=self.organization)
