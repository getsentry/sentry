from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime, timezone
from typing import Any, ClassVar, Generic, Literal, TypedDict, TypeVar, cast

from dateutil.parser import parse as parse_date
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.exceptions import SentryAPIException
from sentry.constants import ObjectStatus
from sentry.integrations.analytics import IntegrationRepoAddedEvent
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository import repository_service
from sentry.integrations.services.repository.model import RpcCreateRepository, RpcRepository
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.models.repository import REPOSITORY_NAME_LENGTH, REPOSITORY_URL_LENGTH
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.signals import repo_linked
from sentry.users.models.user import User
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.utils import metrics

InstT = TypeVar("InstT", bound="RepositoryIntegration[Any]", default=RepositoryIntegration)


class RepositoryConfig(TypedDict):
    name: str
    external_id: str
    url: str
    config: dict[str, Any]
    integration_id: int


class CommitPatchFile(TypedDict):
    """One file a commit touched. `type` is a `CommitFileChange.type` choice."""

    path: str
    type: Literal["A", "D", "M"]


class CommitData(TypedDict):
    """A commit in the shape `Release.set_commits` consumes."""

    id: str
    repository: str
    author_email: str
    author_name: str
    message: str
    timestamp: datetime
    patch_set: Sequence[CommitPatchFile]


class RepoExistsError(SentryAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "repo_exists"
    message = "A repository with that configuration already exists"

    def __init__(
        self,
        code: str | None = None,
        message: str | None = None,
        detail: Any = None,
        repos: list[RepositoryConfig] | None = None,
        existing_repo: RpcRepository | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(code=code, message=message, detail=detail, **kwargs)
        self.repos = repos
        # Populated when create_repository found an existing ACTIVE row matching
        # the config. Callers that can treat the race as a success (e.g. the
        # REST dispatch) should check this before surfacing the 400.
        self.existing_repo = existing_repo

    def __str__(self) -> str:
        if self.repos:
            return f"Repositories already exist: {', '.join(repo['name'] for repo in self.repos)}"
        return "Repositories already exist."


def get_integration_repository_provider(integration: Any) -> Any:
    from sentry.plugins.base import bindings  # circular import

    binding_key = "integration-repository.provider"
    provider_key = (
        integration.provider
        if integration.provider.startswith("integrations:")
        else "integrations:" + integration.provider
    )
    provider_cls = bindings.get(binding_key).get(provider_key)
    return provider_cls(id=provider_key)


class IntegrationRepositoryProvider(Generic[InstT]):
    """
    Repository Provider for Integrations in the Sentry Repository.
    Does not include plugins.
    """

    name: ClassVar[str]
    repo_provider: ClassVar[str]
    # ``Repository.provider`` values written by the plugin that preceded this integration,
    # where they differ from ``repo_provider``. Plugin-era rows have no integration_id and
    # are adopted on install rather than duplicated.
    legacy_provider_ids: ClassVar[tuple[str, ...]] = ()

    can_transfer_repositories: ClassVar[bool] = False

    def __init__(self, id: str) -> None:
        self.id = id
        self.logger = logging.getLogger(f"sentry.integrations.{self.repo_provider}")

    def get_installation(
        self,
        integration_id: int | None,
        organization_id: int,
    ) -> InstT:
        if integration_id is None:
            raise IntegrationError(f"{self.name} requires an integration id.")

        # Both the integration and the organization integration needs to exist for the installation to be valid.

        rpc_integration = integration_service.get_integration(integration_id=integration_id)
        if rpc_integration is None:
            raise Integration.DoesNotExist("Integration matching query does not exist.")

        rpc_org_integration = integration_service.get_organization_integration(
            integration_id=integration_id, organization_id=organization_id
        )
        if rpc_org_integration is None:
            raise Integration.DoesNotExist("Integration matching query does not exist.")

        return cast(InstT, rpc_integration.get_installation(organization_id=organization_id))

    @property
    def owned_provider_ids(self) -> list[str]:
        """Every ``Repository.provider`` value that belongs to this provider.

        An external id is only unique per provider, so lookups by external id must be
        restricted to these or they match another provider's repository with the same id.
        """
        return [self.id, self.repo_provider, *self.legacy_provider_ids]

    def _adoptable_repositories(self, organization_id: int, **filters: Any) -> list[RpcRepository]:
        """Repositories this provider may take over, narrowed by ``filters``.

        Its own rows (including plugin-era ones) and rows that never had a provider. A row
        belonging to another provider is a different repository that happens to share an
        external id, and is left alone.
        """
        return [
            *repository_service.get_repositories(
                organization_id=organization_id, providers=self.owned_provider_ids, **filters
            ),
            *repository_service.get_repositories(
                organization_id=organization_id, has_provider=False, **filters
            ),
        ]

    def create_repository(
        self,
        repo_config: Mapping[str, Any],
        organization: RpcOrganization,
    ) -> tuple[RepositoryConfig, RpcRepository]:
        result = self.build_repository_config(organization=organization, data=repo_config)

        integration_id = result["integration_id"]
        external_id = result["external_id"]
        name = result["name"]
        url = result["url"]

        # first check if there is an existing hidden repository on this integration.
        # a repo on another integration is moved by _transfer_repository further down
        repositories = repository_service.get_repositories(
            organization_id=organization.id,
            integration_id=integration_id,
            providers=[self.id],
            external_id=external_id,
            status=ObjectStatus.HIDDEN,
        )

        existing_repo = repositories[0] if repositories else None
        if existing_repo:
            existing_repo.status = ObjectStatus.ACTIVE
            existing_repo.name = name
            existing_repo.integration_id = integration_id
            existing_repo.url = url
            existing_repo.config = {**existing_repo.config, **(result.get("config") or {})}
            repository_service.update_repository(
                organization_id=organization.id, update=existing_repo
            )
            self.on_create_repository(existing_repo, organization)
            metrics.incr("sentry.integration_repo_provider.repo_relink")
            return result, existing_repo

        # then check if there is a repository without an integration that matches
        repositories = self._adoptable_repositories(
            organization.id, external_id=external_id, has_integration=False
        )
        repo = repositories[0] if repositories else None

        config_updates: dict[str, Any] = result.get("config") or {}
        repo_update_params: dict[str, Any] = {
            "external_id": external_id,
            "url": result.get("url")[:REPOSITORY_URL_LENGTH],
            "config": config_updates,
            "provider": self.id,
            "integration_id": integration_id,
            "name": name[:REPOSITORY_NAME_LENGTH],
        }

        if repo:
            self.logger.info(
                "repository.update",
                extra={
                    "organization_id": organization.id,
                    "repo_name": result["name"],
                    "old_provider": repo.provider,
                },
            )
            # update from params, merging config to preserve keys like webhook_id
            repo.config = {**repo.config, **config_updates}
            for field_name, field_value in repo_update_params.items():
                if field_name != "config":
                    setattr(repo, field_name, field_value)
            # also update the status if it was in a bad state
            repo.status = ObjectStatus.ACTIVE
            repository_service.update_repository(organization_id=organization.id, update=repo)
            self.on_create_repository(repo, organization)
        else:
            create_repository = RpcCreateRepository.parse_obj(
                {**repo_update_params, "status": ObjectStatus.ACTIVE}
            )
            new_repository = repository_service.create_repository(
                organization_id=organization.id, create=create_repository
            )
            if new_repository is not None:
                self.on_create_repository(new_repository, organization)
                return result, new_repository

            # if possible update the repo with matching integration
            repositories = repository_service.get_repositories(
                organization_id=organization.id,
                integration_id=integration_id,
                external_id=external_id,
            )
            active_repo: RpcRepository | None = None
            if repositories:
                # We anticipate to only update one repository, but we update any duplicates as well.
                for repo in repositories:
                    for field_name, field_value in repo_update_params.items():
                        setattr(repo, field_name, field_value)
                    repository_service.update_repository(
                        organization_id=organization.id,
                        update=repo,
                    )
                    if active_repo is None and repo.status == ObjectStatus.ACTIVE:
                        active_repo = repo
            elif self.can_transfer_repositories:
                # the repo exists on another integration of this organization, e.g. it was
                # transferred between GitHub orgs. move it, along with its code mappings
                transferred_repo = self._transfer_repository(organization, result)
                if transferred_repo is not None:
                    return result, transferred_repo

            # Concurrent writer (e.g. link_all_repos) already created the row.
            # Surface the active match on the exception so callers that want to
            # treat the race as success (dispatch) can, while callers that
            # prefer the historical "skip and try again" behavior (the GitHub
            # push webhook) stay unaffected by catching RepoExistsError as
            # before.
            raise RepoExistsError(repos=[result], existing_repo=active_repo)

        return result, repo

    def _apply_repo_config(self, repo: RpcRepository, config: RepositoryConfig) -> RpcRepository:
        """Reactivates ``repo`` and overlays ``config`` onto it in memory. The caller persists it."""
        repo.status = ObjectStatus.ACTIVE
        repo.provider = self.id  # a plugin-era or provider-less row is ours now

        new_config = config.get("config") or {}
        repo.config = {**repo.config, **new_config}
        for field_name, field_value in config.items():
            if field_name != "config":
                setattr(repo, field_name, field_value)
        return repo

    def _apply_configs_to_existing_repos(
        self,
        repositories: list[RpcRepository],
        external_id_to_repo_config: dict[str, RepositoryConfig],
    ) -> dict[str, RpcRepository]:
        """
        Applies each config to the first of ``repositories`` with its external_id, in memory.
        Returns the updated repos keyed by external_id. The caller persists them.
        """
        updated_repos: dict[str, RpcRepository] = {}
        for repo in repositories:
            external_id = repo.external_id
            if (
                external_id
                and external_id not in updated_repos
                and (repo_config := external_id_to_repo_config.get(external_id))
            ):
                updated_repos[external_id] = self._apply_repo_config(repo, repo_config)
        return updated_repos

    def create_repositories(
        self,
        configs: list[dict[str, Any]],
        organization: RpcOrganization,
    ) -> tuple[list[RpcRepository], list[RpcRepository], list[RepositoryConfig]]:
        """
        Create or update repositories from configs.
        Returns (created, reactivated, missing) — newly created repos, repos that
        were reactivated or updated from a hidden/unlinked state, and repo configs
        that could not be created because a repository with that configuration
        already exists.
        """
        external_id_to_repo_config: dict[str, RepositoryConfig] = {}
        for config in configs:
            result = self.build_repository_config(organization=organization, data=config)
            external_id_to_repo_config[result["external_id"]] = result

        repos_to_update: list[RpcRepository] = []
        created_repos: list[RpcRepository] = []
        transferred_repos: list[RpcRepository] = []

        # only reuse hidden repos on the integration being synced. a hidden repo on another
        # integration is moved by _transfer_repository below, which also moves its code mappings.
        integration_ids = {
            config["integration_id"] for config in external_id_to_repo_config.values()
        }
        hidden_repos = [
            repo
            for integration_id in integration_ids
            for repo in repository_service.get_repositories(
                organization_id=organization.id,
                integration_id=integration_id,
                providers=[self.id],
                status=ObjectStatus.HIDDEN,
            )
        ]

        # reuse hidden repos first, then repos without an integration
        unlinked_repos = self._adoptable_repositories(organization.id, has_integration=False)

        for existing_repos in (hidden_repos, unlinked_repos):
            updated_repos = self._apply_configs_to_existing_repos(
                existing_repos, external_id_to_repo_config
            )
            repos_to_update.extend(updated_repos.values())
            # these configs are satisfied by an existing repo, so don't create them
            for external_id in updated_repos:
                del external_id_to_repo_config[external_id]

        # create remaining repositories
        missing_repos: list[RepositoryConfig] = []
        for external_id, repo_config in external_id_to_repo_config.items():
            integration_id = repo_config["integration_id"]
            if "name" in repo_config:
                repo_config["name"] = repo_config["name"][:REPOSITORY_NAME_LENGTH]
            if "url" in repo_config:
                repo_config["url"] = repo_config["url"][:REPOSITORY_URL_LENGTH]

            create_repository = RpcCreateRepository.parse_obj(
                {**repo_config, "provider": self.id, "status": ObjectStatus.ACTIVE}
            )
            new_repository = repository_service.create_repository(
                organization_id=organization.id, create=create_repository
            )
            if new_repository is not None:
                self.on_create_repository(new_repository, organization)
                created_repos.append(new_repository)
                continue

            # we failed to create the repo due to an integrity error
            # as of writing this comment the only constraint is unique_together
            # which means this repo already exists in the database
            # if possible update the repo with matching integration
            repositories = repository_service.get_repositories(
                organization_id=organization.id,
                integration_id=integration_id,
                external_id=external_id,
            )
            if repositories:
                missing_repos.append(repo_config)
                # We anticipate to only update one repository, but we update any duplicates as well.
                for repo in repositories:
                    repos_to_update.append(self._apply_repo_config(repo, repo_config))
                continue

            # if we don't find the repo on this integration, the unique constraint was hit by a
            # repo with this external_id on another integration of this org. move it over if the
            # provider allows it
            if self.can_transfer_repositories:
                transferred_repo = self._transfer_repository(organization, repo_config)
                if transferred_repo is not None:
                    transferred_repos.append(transferred_repo)
                    continue
            # the repo stays on the other integration and can't be linked to this one. this is
            # expected for providers that can't transfer (e.g. GitHub Enterprise hosts reusing
            # numeric IDs) but is otherwise invisible, so log it. IDs only: no names or URLs
            self.logger.info(
                "repository.create.conflict",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration_id,
                    "external_id": external_id,
                    "provider": self.id,
                    "can_transfer_repositories": self.can_transfer_repositories,
                },
            )
            missing_repos.append(repo_config)

        if repos_to_update:
            repository_service.update_repositories(
                organization_id=organization.id,
                updates=repos_to_update,
            )
            for repo in repos_to_update:
                self.on_create_repository(repo, organization)

        return created_repos, repos_to_update + transferred_repos, missing_repos

    def _transfer_repository(
        self, organization: RpcOrganization, repo_config: RepositoryConfig
    ) -> RpcRepository | None:
        """
        Moves the org's existing repository with this external_id onto the config's
        integration, if it currently belongs to a different integration of the same
        provider, and runs ``on_create_repository`` for it. Returns the moved repository,
        or None if nothing was moved.
        """
        # the integration the repo is moving to
        new_integration_id = repo_config["integration_id"]
        # look for any integrations with this repo on the same org
        repositories = repository_service.get_repositories(
            organization_id=organization.id,
            external_id=repo_config["external_id"],
            providers=[self.id],
        )

        repo = next(
            (
                r
                for r in repositories
                if r.integration_id is not None
                and r.integration_id != new_integration_id
                and r.status in (ObjectStatus.ACTIVE, ObjectStatus.DISABLED)  # not being deleted
            ),
            None,
        )
        if repo is None:
            return None

        org_integration = integration_service.get_organization_integration(
            integration_id=new_integration_id, organization_id=organization.id
        )
        if org_integration is None:
            return None

        previous_integration_id = repo.integration_id
        repo = self._apply_repo_config(repo, repo_config)
        if not repository_service.transfer_repository_to_integration(
            organization_id=organization.id,
            update=repo,
            organization_integration_id=org_integration.id,
        ):
            return None

        self.logger.info(
            "repository.transferred",
            extra={
                "organization_id": organization.id,
                "repository_id": repo.id,
                "from_integration_id": previous_integration_id,
                "to_integration_id": new_integration_id,
            },
        )
        metrics.incr(
            "sentry.integration_repo_provider.repo_transferred", tags={"provider": self.id}
        )
        # a no-op for GitHub, the only provider with can_transfer_repositories today. providers
        # that override this hook (e.g. to create webhooks) would need it run on the new integration
        self.on_create_repository(repo, organization)
        return repo

    def dispatch(self, request: Request, organization: Any, **kwargs: Any) -> Response:
        try:
            config = self.get_repository_data(organization, request.data)
        except Exception as e:
            return self.handle_api_error(e)

        try:
            result, repo = self.create_repository(repo_config=config, organization=organization)
        except RepoExistsError as exc:
            metrics.incr("sentry.integration_repo_provider.repo_exists")
            if exc.existing_repo is None or not exc.repos:
                raise
            # A concurrent writer created the row before we could; return it
            # as if our create had succeeded so repo_linked/analytics still
            # fire from the normal success path.
            repo = exc.existing_repo
            result = exc.repos[0]
        except Exception as e:
            return self.handle_api_error(e)

        repo_linked.send_robust(repo=repo, user=request.user, sender=self.__class__)

        analytics.record(
            IntegrationRepoAddedEvent(
                provider=self.id,
                id=result.get("integration_id"),
                organization_id=organization.id,
            )
        )
        return Response(
            repository_service.serialize_repository(
                organization_id=organization.id,
                id=repo.id,
                as_user=(
                    serialize_rpc_user(request.user)
                    if isinstance(request.user, User)
                    else request.user
                ),
            ),
            status=201,
        )

    def handle_api_error(self, e: Exception) -> Response:
        if isinstance(e, IntegrationError):
            if "503" in str(e):
                return Response(
                    {"error_type": "service unavailable", "errors": {"__all__": str(e)}}, status=503
                )
            else:
                # TODO(dcramer): we should have a proper validation error
                return Response(
                    {"error_type": "validation", "errors": {"__all__": str(e)}}, status=400
                )
        elif isinstance(e, Integration.DoesNotExist):
            return Response({"error_type": "not found", "errors": {"__all__": str(e)}}, status=404)
        else:
            self.logger.exception(str(e))
            return Response({"error_type": "unknown"}, status=500)

    def get_config(self, organization: Any) -> Any:
        raise NotImplementedError

    def get_repository_data(
        self, organization: Any, config: MutableMapping[str, Any]
    ) -> MutableMapping[str, Any]:
        """
        Gets the necessary repository data through the integration's API
        """
        return config

    def build_repository_config(
        self, organization: RpcOrganization, data: Mapping[str, Any]
    ) -> RepositoryConfig:
        """
        Builds final dict containing all necessary data to create the repository

            >>> {
            >>>    'name': data['name'],
            >>>    'external_id': data['external_id'],
            >>>    'url': data['url'],
            >>>    'config': {
            >>>        # Any additional data
            >>>    },
            >>>    'integration_id': data['installation'],
            >>> }
        """
        raise NotImplementedError

    def on_create_repository(self, repo: RpcRepository, organization: RpcOrganization) -> None:
        """Called after a repository is created or reactivated.

        Override to perform post-creation setup like webhook creation.
        The repo has already been persisted — update repo.config and call
        repository_service.update_repository to store any new config values.
        """

    def on_delete_repository(self, repo: Any) -> None:
        pass

    def format_date(self, date: str | None) -> Any | None:
        if not date:
            return None
        return parse_date(date).astimezone(timezone.utc)

    def compare_commits(
        self, repo: Any, start_sha: str | None, end_sha: str
    ) -> Sequence[Mapping[str, Any]]:
        """
        Generate a list of commits between the start & end sha
        Commits should be of the following format:
            >>> {
            >>>     'id': commit['id'],
            >>>     'repository': repo.name,
            >>>     'author_email': commit['author']['email'],
            >>>     'author_name': commit['author']['name'],
            >>>     'message': commit['message'],
            >>>     'timestamp': self.format_date(commit['timestamp']),
            >>>     'patch_set': commit['patch_set'],
            >>> }
        """
        raise NotImplementedError

    def fetch_recent_commits(
        self, repo: Any, end_sha: str, *, actor: Any | None = None
    ) -> Sequence[Mapping[str, Any]]:
        return self.compare_commits(repo, None, end_sha)

    def fetch_commits_for_compare_range(
        self, repo: Any, start_sha: str, end_sha: str, *, actor: Any | None = None
    ) -> Sequence[Mapping[str, Any]]:
        return self.compare_commits(repo, start_sha, end_sha)

    def get_scm_provider_key(self) -> str:
        return self.repo_provider

    def pull_request_url(self, repo: Any, pull_request: Any) -> str | None:
        """
        Generate a URL to a pull request on the repository provider.
        """
        return None

    def repository_external_slug(self, repo: Any) -> str | None:
        """
        Generate the public facing 'external_slug' for a repository
        The shape of this id must match the `identifier` returned by
        the integration's Integration.get_repositories() method
        """
        return repo.name

    @staticmethod
    def should_ignore_commit(message: str) -> bool:
        return "#skipsentry" in message
