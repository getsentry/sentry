import logging
from dataclasses import dataclass
from typing import Any

from django.utils.functional import cached_property

from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.repository import repository_service
from sentry.integrations.services.repository.model import RpcRepository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base import plugins
from sentry.plugins.base.v1 import Plugin
from sentry.plugins.base.v2 import Plugin2
from sentry.projects.services.project.model import RpcProject

logger = logging.getLogger("sentry.plugins.migrator")


@dataclass
class Migrator:
    integration: RpcIntegration
    organization: RpcOrganization

    def run(self) -> None:
        for project in self.projects:
            for plugin in plugins.for_project(project):
                if plugin.slug != self.integration.provider:
                    continue

                if self.all_repos_migrated(plugin.slug):
                    # Since repos are Org-level, if they're all migrated, we
                    # can disable the Plugin for all Projects. There'd be no
                    # Repos left, associated with the Plugin.
                    self.disable_for_all_projects(plugin)

    def all_repos_migrated(self, provider: str) -> bool:
        return all(r.integration_id is not None for r in self.repos_for_provider(provider))

    def disable_for_all_projects(self, plugin: Plugin2 | Plugin) -> None:
        for project in self.projects:
            try:
                logger.info(
                    "plugin.disabled",
                    extra=self._logging_context({"project": project.slug, "plugin": plugin.slug}),
                )
                plugin.disable(project=project)
            except NotImplementedError:
                pass

    def repos_for_provider(self, provider: str) -> list[RpcRepository]:
        return [r for r in self.repositories if r.provider == provider]

    @property
    def repositories(self) -> list[RpcRepository]:
        return repository_service.get_repositories(organization_id=self.organization.id)

    @cached_property
    def projects(self) -> list[RpcProject]:
        return list(self.organization.projects)

    @property
    def plugins(self) -> list[Plugin2 | Plugin]:
        return [plugins.configurable_for_project(project) for project in self.projects]

    def _logging_context(self, context: dict[str, Any]) -> dict[str, Any]:
        context.update(
            {
                "org": self.organization.slug,
                "integration_id": self.integration.id,
                "integration_provider": self.integration.provider,
            }
        )
        return context
