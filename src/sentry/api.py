"""
sentry.api
~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import base64
from django.contrib.auth.models import AnonymousUser
from tastypie.authentication import Authentication
from tastypie.authorization import Authorization
from tastypie.api import Api
from tastypie.resources import ModelResource
from sentry.models import Group, ProjectKey
from sentry.web.helpers import get_project_list


class SentryAuthentication(Authentication):
    def is_authenticated(self, request, **kwargs):
        """
        Simple basic auth where username is the public key, and password
        is the secret key.
        """
        auth = request.META.get('HTTP_AUTHORIZATION')
        if not auth:
            return False

        if not auth.startswith('Basic '):
            return

        try:
            decoded = base64.b64decode(auth.split(' ', 1)[-1])
            public, secret = decoded.split(':', 1)
        except Exception:
            return False

        try:
            apikey = ProjectKey.objects.get(public_key=public, secret_key=secret)
        except ProjectKey.DoesNotExist:
            return False

        request.projects = [apikey.project] or get_project_list(apikey.user)
        request.user = apikey.user or AnonymousUser()
        request.apikey = apikey

        return True

    def get_identifier(self, request):
        return request.apikey.id


class SentryAuthorization(Authorization):
    def apply_limits(self, request, object_list):
        if not request.projects:
            return object_list.none()
        return object_list.filter(project__in=request.projects)


class GroupResource(ModelResource):
    class Meta:
        queryset = Group.objects.all()
        resource_name = 'group'
        allowed_methods = ['get']
        authentication = SentryAuthentication()
        authorization = SentryAuthorization()

v1_api = Api(api_name='v1')
v1_api.register(GroupResource())
