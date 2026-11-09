# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Any

from sentry.hybridcloud.rpc.resolvers import ByCellName
from sentry.hybridcloud.rpc.service import RpcService, cell_rpc_method
from sentry.silo.base import SiloMode


class JiraForgeService(RpcService):
    key = "jira_forge"
    local_mode = SiloMode.CELL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.integrations.services.jira_forge.impl import DatabaseBackedJiraForgeService

        return DatabaseBackedJiraForgeService()

    @cell_rpc_method(resolve=ByCellName())
    @abstractmethod
    def handle_issue_updated(
        self, *, cell_name: str, integration_id: int, event: dict[str, Any]
    ) -> None:
        """
        Apply a Forge `avi:jira:updated:issue` event to the linked Sentry issues in
        this cell. Control verifies the event before handing it over, so the cell
        does no authentication of its own.
        """


jira_forge_service = JiraForgeService.create_delegation()
