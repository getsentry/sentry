from sentry.integrations.example import ExampleIntegrationProvider
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.models.repository import Repository
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.plugins.base import plugins
from sentry.plugins.bases.issue2 import IssuePlugin2
from sentry.plugins.migrator import Migrator
from sentry.testutils.cases import TestCase


class ExamplePlugin(IssuePlugin2):
    slug = "example"


plugins.register(ExamplePlugin)


class MigratorTest(TestCase):
    def setUp(self):
        super().setUp()

        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)

        self.integration = self.create_provider_integration(provider=ExampleIntegrationProvider.key)

        self.migrator = Migrator(
            integration=serialize_integration(self.integration),
            organization=serialize_rpc_organization(self.organization),
        )

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

        self.migrator.run()
        assert plugin not in plugins.for_project(self.project)

    def test_does_not_disable_any_plugin(self):
        plugin = plugins.get("webhooks")
        plugin.enable(self.project)

        self.migrator.run()
        assert plugin in plugins.for_project(self.project)

    def test_logs(self):
        Migrator(
            integration=serialize_integration(self.integration),
            organization=serialize_rpc_organization(self.organization),
        ).run()
