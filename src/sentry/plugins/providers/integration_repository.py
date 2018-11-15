from __future__ import absolute_import

import six
from django.db import IntegrityError, transaction
from rest_framework.response import Response

from sentry import analytics
from sentry.api.serializers import serialize
from sentry.integrations.exceptions import IntegrationError
from sentry.models import Repository
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
            config = self.get_repository_data(organization, request.DATA)
        except Exception as e:
            return self.handle_api_error(e)

        try:
            result = self.build_repository_config(
                organization=organization,
                data=config,
            )
        except IntegrationError as e:
            return Response(
                {
                    'errors': {
                        '__all__': e.message
                    },
                }, status=400
            )

        try:
            with transaction.atomic():
                repo = Repository.objects.create(
                    organization_id=organization.id,
                    name=result['name'],
                    external_id=result.get('external_id'),
                    url=result.get('url'),
                    config=result.get('config') or {},
                    provider=self.id,
                    integration_id=result.get('integration_id'),
                )
        except IntegrityError:
            # Try to delete webhook we just created
            try:
                repo = Repository(
                    organization_id=organization.id,
                    name=result['name'],
                    external_id=result.get('external_id'),
                    url=result.get('url'),
                    config=result.get('config') or {},
                    provider=self.id,
                    integration_id=result.get('integration_id'),
                )
                self.on_delete_repository(repo)
            except IntegrationError:
                pass
            return Response(
                {'errors': {'__all__': 'A repository with that name already exists'}},
                status=400,
            )
        else:
            repo_linked.send_robust(repo=repo, user=request.user, sender=self.__class__)

        analytics.record(
            'integration.repo.added',
            provider=self.id,
            id=result.get('integration_id'),
            organization_id=organization.id,
        )
        return Response(serialize(repo, request.user), status=201)

    def handle_api_error(self, error):
        context = {
            'error_type': 'unknown',
        }
        if isinstance(error, IntegrationError):
            # TODO(dcramer): we should have a proper validation error
            context.update({
                'error_type': 'validation',
                'errors': {
                    '__all__': error.message
                },
            })
            status = 400
        else:
            if self.logger:
                self.logger.exception(six.text_type(error))
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

    def compare_commits(self, repo, start_sha, end_sha):
        """
        Generate a list of commits between the start & end sha
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
        return '#skipsentry' in message
