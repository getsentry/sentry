from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Iterable, List, Optional

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models import Organization, Project


@dataclass
class ApiUserOption:
    id: int = -1
    user_id: int = -1
    value: Any = None
    key: str = ""
    project_id: int | None = None
    organization_id: int | None = None


class UserOptionService(InterfaceWithLifecycle):
    @abstractmethod
    def delete_options(self, *, options: List[ApiUserOption]) -> None:
        pass

    @abstractmethod
    def get_many(
        self,
        *,
        user_ids: Iterable[int],
        keys: Iterable[str],
        project: Optional[Project] = None,
        organization: Optional[Organization] = None,
    ) -> List[ApiUserOption]:
        """ """
        pass


def impl_with_db() -> UserOptionService:
    from sentry.services.hybrid_cloud.user_option.impl import DatabaseBackedUserOptionService

    return DatabaseBackedUserOptionService()


user_option_service: UserOptionService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
        SiloMode.CONTROL: impl_with_db,
    }
)
