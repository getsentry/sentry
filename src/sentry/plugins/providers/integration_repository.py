from __future__ import absolute_import

import dateutil.parser
import six
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.response import Response

from sentry import analytics
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.models import Repository, Integration
from sentry.signals import repo_linked


class IntegrationRepositoryProvider(object):
    """
    Repository Provider for Integrations in the Sentry Repository.
    Does not include plugins.
    """

    name = None
    logger = None
    repo_provider = None

    def __init__(self, id):
        self.id = id

    def dispatch(self, request, organization, **kwargs):
        try:
            config = self.get_repository_data(organization, request.data)
            result = self.build_repository_config(organization=organization, data=config)
        except Exception as e:
            return self.handle_api_error(e)

        repo_update_params = {
            "external_id": result.get("external_id"),
            "url": result.get("url"),
            "config": result.get("config") or {},
            "provider": self.id,
            "integration_id": result.get("integration_id"),
        }

        # first check if there is a repository without an integration that matches
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
            for field_name, field_value in six.iteritems(repo_update_params):
                setattr(repo, field_name, field_value)
            # also update the status if it was in a bad state
            repo.status = ObjectStatus.VISIBLE
            repo.save()
        else:
            try:
                with transaction.atomic():
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
                return Response(
                    {"errors": {"__all__": "A repository with that name already exists"}},
                    status=400,
                )
            else:
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
            if "503" in six.text_type(e):
                context.update(
                    {"error_type": "service unavailable", "errors": {"__all__": six.text_type(e)}}
                )
                status = 503
            else:
                # TODO(dcramer): we should have a proper validation error
                context.update(
                    {"error_type": "validation", "errors": {"__all__": six.text_type(e)}}
                )
                status = 400
        elif isinstance(e, Integration.DoesNotExist):
            context.update({"error_type": "not found", "errors": {"__all__": six.text_type(e)}})
            status = 404
        else:
            if self.logger:
                self.logger.exception(six.text_type(e))
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
        return dateutil.parser.parse(date).astimezone(timezone.utc)

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
