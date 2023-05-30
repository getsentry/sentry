from __future__ import annotations

from typing import List

from sentry.services.hybrid_cloud.repository import RepositoryService, RpcRepository


class DatabaseBackedRepositoryService(RepositoryService):
    def get_repositories(self, *, organization_id: int) -> List[RpcRepository]:
        pass
