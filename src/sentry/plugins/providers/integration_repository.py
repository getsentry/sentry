from __future__ import annotations

import logging
from typing import Any, MutableMapping

from dateutil.parser import parse as parse_date
from django.db import IntegrityError, router, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.integrations import IntegrationInstallation
from sentry.models import Integration, Repository
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.signals import repo_linked
from sentry.utils import metrics


class RepoExistsError(APIException):
    status_code = 400
    detail = {"errors": {"__all__": "A repository with that name already exists"}}


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

    name = None
    repo_provider = None

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

        return integration_service.get_installation(
            integration=rpc_integration, organization_id=organization_id
        )

    def create_repository(
        self,
        repo_config: MutableMapping[str, Any],
        organization,
    ):
        result = self.build_repository_config(organization=organization, data=repo_config)

        integration_id = result.get("integration_id")
        external_id = result.get("external_id")

        repo_update_params = {
            "external_id": external_id,
            "url": result.get("url"),
            "config": result.get("config") or {},
            "provider": self.id,
            "integration_id": integration_id,
        }

        # first check if there is an existing hidden repository with an integration that matches
        existing_repo = Repository.objects.filter(
            organization_id=organization.id,
            name=result["name"],
            integration_id=integration_id,
            external_id=external_id,
            status=ObjectStatus.HIDDEN,
        ).first()
        if existing_repo:
            existing_repo.status = ObjectStatus.ACTIVE
            existing_repo.save()
            metrics.incr("sentry.integration_repo_provider.repo_relink")
            return result, existing_repo

        # then check if there is a repository without an integration that matches
        repo = Repository.objects.filter(
            organization_id=organization.id, name=result["name"], integration_id=None
        ).first()

        if repo:
            if self.logger:
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
            repo.save()
        else:
            try:
                with transaction.atomic(router.db_for_write(Repository)):
                    repo = Repository.objects.create(
                        organization_id=organization.id, name=result["name"], **repo_update_params
                    )
            except IntegrityError:
                # Try to delete webhook we just created
                try:
                    repo = Repository(
                        organization_id=organization.id, name=result["name"], **repo_update_params
                    )
                    self.on_delete_repository(repo)
                except IntegrationError:
                    pass

                raise RepoExistsError

        return result, repo

    def dispatch(self, request: Request, organization, **kwargs):
        try:
            config = self.get_repository_data(organization, request.data)
        except Exception as e:
            return self.handle_api_error(e)

        try:
            result, repo = self.create_repository(repo_config=config, organization=organization)
        except Exception as e:
            return self.handle_api_error(e)

        repo_linked.send_robust(repo=repo, user=request.user, sender=self.__class__)

        analytics.record(
            "integration.repo.added",
            provider=self.id,
            id=result.get("integration_id"),
            organization_id=organization.id,
        )
        return Response(serialize(repo, request.user), status=201)

    def handle_api_error(self, e):
        context = {"error_type": "unknown"}

        if isinstance(e, IntegrationError):
            if "503" in str(e):
                context.update({"error_type": "service unavailable", "errors": {"__all__": str(e)}})
                status = 503
            else:
                # TODO(dcramer): we should have a proper validation error
                context.update({"error_type": "validation", "errors": {"__all__": str(e)}})
                status = 400
        elif isinstance(e, Integration.DoesNotExist):
            context.update({"error_type": "not found", "errors": {"__all__": str(e)}})
            status = 404
        else:
            if self.logger:
                self.logger.exception(str(e))
            status = 500
        return Response(context, status=status)

    def get_config(self, organization):
        raise NotImplementedError

    def get_repository_data(self, organization, config):
        """
        Gets the necessary repository data through the integration's API
        """
        return config

    def build_repository_config(self, organization, data):
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
