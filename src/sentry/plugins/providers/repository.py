from __future__ import absolute_import

from django.core.urlresolvers import reverse
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.models import Repository
from sentry.plugins.config import ConfigValidator

from .base import ProviderMixin


class RepositoryProvider(ProviderMixin):
    name = None

    def __init__(self, id):
        self.id = id

    def dispatch(self, request, organization, **kwargs):
        if self.needs_auth(request.user):
            # TODO(dcramer): this should be a 401
            return Response({
                'error_type': 'auth',
                'title': self.name,
                'auth_url': reverse('socialauth_associate', args=[self.auth_provider]),
            }, status=400)

        try:
            fields = self.get_config()
        except Exception as e:
            return self.handle_api_error(e)

        if request.method == 'GET':
            return Response(fields)

        validator = ConfigValidator(fields, request.DATA)
        if not validator.is_valid():
            return Response({
                'error_type': 'validation',
                'errors': validator.errors,
            }, status=400)

        try:
            config = self.validate_config(organization, validator.result,
                                          actor=request.user)
        except Exception as e:
            return self.handle_api_error(e)

        result = self.create_repository(
            organization=organization,
            data=config,
            actor=request.user,
        )

        repo = Repository.objects.create(
            organization_id=organization.id,
            name=result['name'],
            external_id=result.get('external_id'),
            url=result.get('url'),
            config=result.get('config') or {},
            provider=self.id,
        )

        return Response(serialize(repo, request.user), status=201)

    def get_config(self):
        raise NotImplementedError

    def validate_config(self, organization, config, actor=None):
        return config

    def create_repository(self, organization, data, actor=None):
        raise NotImplementedError

    def delete_repository(self, repo, actor=None):
        pass
