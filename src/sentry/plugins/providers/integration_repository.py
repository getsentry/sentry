from __future__ import annotations

import logging
from datetime import timezone
from typing import Any, ClassVar, TypedDict

from dateutil.parser import parse as parse_date
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository import repository_service
from sentry.integrations.services.repository.model import RpcCreateRepository, RpcRepository
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.signals import repo_linked
from sentry.users.models.user import User
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.utils import metrics


class RepositoryConfig(TypedDict):
    name: str
    external_id: str
    url: str
    config: dict[str, Any]
    integration_id: int


class RepoExistsError(Exception):
    def __init__(self, repos: list[RepositoryConfig] | None = None):
        self.repos = repos

    def __str__(self):
        if self.repos:
            return f"Repositories already exist: {', '.join(repo['name'] for repo in self.repos)}"
        return "Repositories already exist."


def get_integration_repository_provider(integration):
    from sentry.plugins.base import bindings  # circular import

    binding_key = "integration-repository.provider"
    provider_key = (
        integration.provider
        if integration.provider.startswith("integrations:")
        else "integrations:" + integration.provider
    )
    provider_cls = bindings.get(binding_key).get(provider_key)
    return provider_cls(id=provider_key)


class IntegrationRepositoryProvider:
    """
    Repository Provider for Integrations in the Sentry Repository.
    Does not include plugins.
    """

    name: ClassVar[str]
    repo_provider: ClassVar[str]

    def __init__(self, id):
        self.id = id
        self.logger = logging.getLogger(f"sentry.integrations.{self.repo_provider}")

    def get_installation(
        self,
        integration_id: int | None,
        organization_id: int,
    ) -> IntegrationInstallation:
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

        return rpc_integration.get_installation(organization_id=organization_id)

    def create_repository(
        self,
        repo_config: dict[str, Any],
        organization: RpcOrganization,
    ):
        result = self.build_repository_config(organization=organization, data=repo_config)

        integration_id = result["integration_id"]
        external_id = result["external_id"]
        name = result["name"]
        url = result["url"]

        # first check if there is an existing hidden repository for the organization and external id
        repositories = repository_service.get_repositories(
            organization_id=organization.id,
            external_id=external_id,
            status=ObjectStatus.HIDDEN,
        )
        existing_repo = repositories[0] if repositories else None
        if existing_repo:
            existing_repo.status = ObjectStatus.ACTIVE
            existing_repo.name = name
            existing_repo.integration_id = integration_id
            existing_repo.url = url
            repository_service.update_repository(
                organization_id=organization.id, update=existing_repo
            )
            metrics.incr("sentry.integration_repo_provider.repo_relink")
            return result, existing_repo

        # then check if there is a repository without an integration that matches
        repositories = repository_service.get_repositories(
            organization_id=organization.id,
            has_integration=False,
            external_id=external_id,
        )
        repo = repositories[0] if repositories else None

        repo_update_params = {
            "external_id": external_id,
            "url": result.get("url"),
            "config": result.get("config") or {},
            "provider": self.id,
            "integration_id": integration_id,
            "name": name,
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
            # update from params
            for field_name, field_value in repo_update_params.items():
                setattr(repo, field_name, field_value)
            # also update the status if it was in a bad state
            repo.status = ObjectStatus.ACTIVE
            repository_service.update_repository(organization_id=organization.id, update=repo)
        else:
            create_repository = RpcCreateRepository.parse_obj(
                {**repo_update_params, "status": ObjectStatus.ACTIVE}
            )
            new_repository = repository_service.create_repository(
                organization_id=organization.id, create=create_repository
            )
            if new_repository is not None:
                return result, new_repository

            # Try to delete webhook we just created
            try:
                self.on_delete_repository(
                    Repository(organization_id=organization.id, **repo_update_params)
                )
            except IntegrationError:
                pass

            # if possible update the repo with matching integration
            repositories = repository_service.get_repositories(
                organization_id=organization.id,
                integration_id=integration_id,
                external_id=external_id,
            )
            if repositories:
                # We anticipate to only update one repository, but we update any duplicates as well.
                for repo in repositories:
                    for field_name, field_value in repo_update_params.items():
                        setattr(repo, field_name, field_value)
                    repository_service.update_repository(
                        organization_id=organization.id,
                        update=repo,
                    )

            raise RepoExistsError(repos=[result])

        return result, repo

    def _update_repository(self, repo: RpcRepository, config: RepositoryConfig):
        repo.status = ObjectStatus.ACTIVE

        for field_name, field_value in config.items():
            setattr(repo, field_name, field_value)
        return repo

    def _update_repositories(
        self,
        repositories: list[RpcRepository],
        external_id_to_repo_config: dict[str, RepositoryConfig],
    ) -> list[RpcRepository]:
        repos_to_update: list[RpcRepository] = []
        for repo in repositories:
            external_id = repo.external_id
            if external_id and (repo_config := external_id_to_repo_config.get(external_id)):
                repos_to_update.append(self._update_repository(repo, repo_config))
                external_id_to_repo_config.pop(external_id, None)
        return repos_to_update

    def create_repositories(
        self,
        configs: list[dict[str, Any]],
        organization: RpcOrganization,
    ):
        external_id_to_repo_config: dict[str, RepositoryConfig] = {}
        for config in configs:
            result = self.build_repository_config(organization=organization, data=config)
            external_id_to_repo_config[result["external_id"]] = result

        repos_to_update: list[RpcRepository] = []

        hidden_repos = repository_service.get_repositories(
            organization_id=organization.id,
            status=ObjectStatus.HIDDEN,
        )
        repos_to_update.extend(self._update_repositories(hidden_repos, external_id_to_repo_config))

        # then check if there are repositories without an integration that matches
        repositories = repository_service.get_repositories(
            organization_id=organization.id,
            has_integration=False,
        )
        repos_to_update.extend(self._update_repositories(repositories, external_id_to_repo_config))

        # create remaining repositories
        missing_repos: list[RepositoryConfig] = []
        for external_id, repo_config in external_id_to_repo_config.items():
            integration_id = repo_config["integration_id"]
            create_repository = RpcCreateRepository.parse_obj(
                {**repo_config, "provider": self.id, "status": ObjectStatus.ACTIVE}
            )
            new_repository = repository_service.create_repository(
                organization_id=organization.id, create=create_repository
            )
            if new_repository is not None:
                continue

            missing_repos.append(repo_config)
            # Try to delete webhook we just created
            try:
                self.on_delete_repository(
                    Repository(organization_id=organization.id, **repo_config)
                )
            except IntegrationError:
                pass

            # if possible update the repo with matching integration
            repositories = repository_service.get_repositories(
                organization_id=organization.id,
                integration_id=integration_id,
                external_id=external_id,
            )
            # We anticipate to only update one repository, but we update any duplicates as well.
            for repo in repositories:
                repos_to_update.append(self._update_repository(repo, repo_config))

        if repos_to_update:
            repository_service.update_repositories(
                organization_id=organization.id,
                updates=repos_to_update,
            )

        if missing_repos:
            raise RepoExistsError(repos=missing_repos)

    def dispatch(self, request: Request, organization, **kwargs):
        try:
            config = self.get_repository_data(organization, request.data)
        except Exception as e:
            return self.handle_api_error(e)

        try:
            result, repo = self.create_repository(repo_config=config, organization=organization)
        except RepoExistsError:
            metrics.incr("sentry.integration_repo_provider.repo_exists")
            raise
        except Exception as e:
            return self.handle_api_error(e)

        repo_linked.send_robust(repo=repo, user=request.user, sender=self.__class__)

        analytics.record(
            "integration.repo.added",
            provider=self.id,
            id=result.get("integration_id"),
            organization_id=organization.id,
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

    def get_config(self, organization):
        raise NotImplementedError

    def get_repository_data(self, organization, config):
        """
        Gets the necessary repository data through the integration's API
        """
        return config

    def build_repository_config(
        self, organization: RpcOrganization, data: dict[str, Any]
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

    def on_delete_repository(self, repo):
        pass

    def format_date(self, date):
        if not date:
            return None
        return parse_date(date).astimezone(timezone.utc)

    def compare_commits(self, repo, start_sha, end_sha):
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

    def pull_request_url(self, repo, pull_request):
        """
        Generate a URL to a pull request on the repository provider.
        """
        return None

    def repository_external_slug(self, repo):
        """
        Generate the public facing 'external_slug' for a repository
        The shape of this id must match the `identifier` returned by
        the integration's Integration.get_repositories() method
        """
        return repo.name

    @staticmethod
    def should_ignore_commit(message):
        return "#skipsentry" in message
