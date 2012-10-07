"""
sentry.api
~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from tastypie.authentication import BasicAuthentication
from tastypie.authorization import Authorization
from tastypie.api import Api
from tastypie.resources import ModelResource
from sentry.models import Group
from sentry.web.helpers import get_project_list

# TODO: refactor ProjectKey so that keys are not bound to projects, but to users
# XXX: we still need user-less projects keys
# class SentryAuthentication(Authentication):
#     def is_authenticated(self, request, **kwargs):
#         """
#         Finds the user and checks their API key.

#         Should return either ``True`` if allowed, ``False`` if not or an
#         ``HttpResponse`` if you need something custom.
#         """
#         auth_vars = extract_auth_vars(request)
#         if not auth_vars:
#             return self._unauthorized()
#         data = request.raw_post_data

#         if auth_vars:
#             server_version = auth_vars.get('sentry_version', '1.0')
#             client = auth_vars.get('sentry_client', request.META.get('HTTP_USER_AGENT'))

#     def get_identifier(self, request):
#         return request.REQUEST.get('username', 'nouser')


class SentryAuthorization(Authorization):
    def apply_limits(self, request, object_list):
        if request and hasattr(request, 'user'):
            project_list = get_project_list(request.user)
            return object_list.filter(project__in=project_list)

        return object_list.none()


class GroupResource(ModelResource):
    class Meta:
        queryset = Group.objects.all()
        resource_name = 'group'
        allowed_methods = ['get']
        authentication = BasicAuthentication()
        authorization = SentryAuthorization()

v1_api = Api(api_name='v1')
v1_api.register(GroupResource())
