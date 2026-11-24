from __future__ import annotations

from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Generic, Protocol, TypedDict, TypeVar

from sentry.constants import ObjectStatus


class RepositoryConfig(TypedDict):
    name: str
    external_id: str
    url: str
    config: dict[str, Any]
    integration_id: int


class RepositorySnapshot(Protocol):
    id: int
    external_id: str | None
    integration_id: int | None
    provider: str | None
    status: int


RepositoryT = TypeVar("RepositoryT", bound=RepositorySnapshot)


@dataclass(frozen=True)
class RepositoryReconciliationPolicy:
    canonical_provider: str
    adoptable_providers: frozenset[str]
    can_transfer: bool


@dataclass(frozen=True)
class RepositoryReconciliationPlan(Generic[RepositoryT]):
    to_create: tuple[RepositoryConfig, ...]
    to_update: tuple[tuple[RepositoryT, RepositoryConfig], ...]
    to_transfer: tuple[tuple[RepositoryT, RepositoryConfig], ...]
    conflicts: tuple[tuple[RepositoryT, RepositoryConfig], ...]
    already_active_repository_ids: frozenset[int]
    already_active_configs: tuple[RepositoryConfig, ...]


def index_repository_configs(configs: Sequence[RepositoryConfig]) -> dict[str, RepositoryConfig]:
    """Indexes normalized configs by external ID. The last duplicate wins."""
    return {config["external_id"]: config for config in configs}


def select_adoptable_repositories(
    candidates: Sequence[RepositoryT],
    *,
    taken_external_ids: Collection[str | None],
    policy: RepositoryReconciliationPolicy,
) -> list[RepositoryT]:
    """Selects legacy or provider-less rows that can be rewritten to the canonical provider."""
    return [
        repo
        for repo in candidates
        if (
            repo.provider == policy.canonical_provider
            or repo.provider is None
            or repo.provider in policy.adoptable_providers
        )
        and (
            repo.provider == policy.canonical_provider or repo.external_id not in taken_external_ids
        )
    ]


def index_repository_snapshots(
    repositories: Sequence[RepositoryT], external_ids: Collection[str]
) -> dict[str, RepositoryT]:
    """Picks the first usable repository for each requested external ID."""
    found: dict[str, RepositoryT] = {}
    for repo in repositories:
        external_id = repo.external_id
        if external_id is None or external_id not in external_ids or external_id in found:
            continue
        if repo.status in (ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS):
            continue
        found[external_id] = repo
    return found


def plan_repository_reconciliation(
    configs_by_external_id: Mapping[str, RepositoryConfig],
    existing_repositories: Mapping[str, RepositoryT],
    *,
    policy: RepositoryReconciliationPolicy,
) -> RepositoryReconciliationPlan[RepositoryT]:
    """Classifies repository work without fetching or mutating repositories."""
    to_create: list[RepositoryConfig] = []
    to_update: list[tuple[RepositoryT, RepositoryConfig]] = []
    to_transfer: list[tuple[RepositoryT, RepositoryConfig]] = []
    conflicts: list[tuple[RepositoryT, RepositoryConfig]] = []
    already_active_repository_ids: set[int] = set()
    already_active_configs: list[RepositoryConfig] = []

    for external_id, config in configs_by_external_id.items():
        repo = existing_repositories.get(external_id)
        if repo is None:
            to_create.append(config)
            continue

        if repo.integration_id == config["integration_id"] or repo.integration_id is None:
            to_update.append((repo, config))
            if (
                repo.status == ObjectStatus.ACTIVE
                and repo.integration_id == config["integration_id"]
            ):
                already_active_repository_ids.add(repo.id)
                already_active_configs.append(config)
            continue

        if policy.can_transfer:
            to_transfer.append((repo, config))
        else:
            conflicts.append((repo, config))

    return RepositoryReconciliationPlan(
        to_create=tuple(to_create),
        to_update=tuple(to_update),
        to_transfer=tuple(to_transfer),
        conflicts=tuple(conflicts),
        already_active_repository_ids=frozenset(already_active_repository_ids),
        already_active_configs=tuple(already_active_configs),
    )
