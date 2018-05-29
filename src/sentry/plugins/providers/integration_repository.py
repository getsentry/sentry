from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.exceptions import PluginError
from sentry.models import Repository
from sentry.plugins.config import ConfigValidator

from .base import ProviderMixin


class IntegrationRepositoryProvider(ProviderMixin):
    name = None

    def __init__(self, id):
        self.id = id

    def dispatch(self, request, organization, **kwargs):
        try:
            fields = self.get_config(organization)
        except Exception as e:
            return self.handle_api_error(e)

        if request.method == 'GET':
            return Response(fields)

        validator = ConfigValidator(fields, request.DATA)
        if not validator.is_valid():
            return Response(
                {
                    'error_type': 'validation',
                    'errors': validator.errors,
                }, status=400
            )

        try:
            config = self.validate_config(organization, validator.result, actor=request.user)
        except Exception as e:
            return self.handle_api_error(e)

        try:
            result = self.create_repository(
                organization=organization,
                data=config,
                actor=request.user,
            )
        except PluginError as e:
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
                self.delete_repository(repo, actor=request.user)
            except PluginError:
                pass
            return Response(
                {'errors': {'__all__': 'A repository with that name already exists'}},
                status=400,
            )

        return Response(serialize(repo, request.user), status=201)

    def get_config(self, organization):
        raise NotImplementedError

    def validate_config(self, organization, config, actor=None):
        return config

    def create_repository(self, organization, data, actor=None):
        raise NotImplementedError

    def delete_repository(self, repo, actor=None):
        pass

    def compare_commits(self, repo, start_sha, end_sha, actor=None):
        raise NotImplementedError

    @staticmethod
    def should_ignore_commit(message):
        return '#skipsentry' in message
