"""
sentry.api
~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import base64
from django.contrib.auth.models import User, AnonymousUser
from tastypie import fields
from tastypie.authentication import Authentication
from tastypie.authorization import Authorization
from tastypie.api import Api
from tastypie.resources import ModelResource
from sentry.models import Project, Team, TeamMember, Group, Event, ProjectKey
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
        if apikey.user:
            request.teams = Team.objects.get_for_user(apikey.user)
        else:
            request.teams = []
        request.user = apikey.user or AnonymousUser()
        request.apikey = apikey

        return True

    def get_identifier(self, request):
        # XXX: no idea what this is for
        return request.apikey.id


class TeamAuthorization(Authorization):
    def apply_limits(self, request, object_list):
        if request.projects:
            return object_list.filter(project__in=request.projects)
        elif request.teams:
            return object_list.filter(pk__in=[t.pk for t in request.teams])
        return object_list.none()


class TeamBasedAuthorization(Authorization):
    def apply_limits(self, request, object_list):
        if request.projects:
            return object_list.filter(team__project__in=request.projects)
        elif request.teams:
            return object_list.filter(team__in=request.teams)
        return object_list.none()


class ProjectAuthorization(Authorization):
    def apply_limits(self, request, object_list):
        if request.projects:
            return object_list.filter(pk__in=[p.id for p in request.projects])
        elif request.teams:
            return object_list.filter(team__in=request.teams)
        return object_list.none()


class ProjectBasedAuthorization(Authorization):
    def apply_limits(self, request, object_list):
        if request.projects:
            return object_list.filter(project__in=request.projects)
        elif request.teams:
            return object_list.filter(team__in=request.teams)
        return object_list.none()


class UserResource(ModelResource):
    username = fields.CharField('username', readonly=True)
    # name = fields.CharField('first_name', readonly=True)

    class Meta:
        queryset = User.objects.all()
        detail_uri_name = 'username'
        include_resource_uri = False
        resource_name = 'user'
        detail_allowed_methods = []
        list_allowed_methods = []
        fields = ['username']
        authentication = SentryAuthentication()


class TeamResource(ModelResource):
    slug = fields.CharField(attribute="slug", readonly=True)
    owner = fields.ToOneField(UserResource, 'owner', full=True, readonly=True)
    members = fields.ToManyField('sentry.api.TeamMemberResource', 'member_set', full=True)

    class Meta:
        queryset = Team.objects.all()
        detail_uri_name = 'slug'
        resource_name = 'team'
        detail_allowed_methods = ['get']
        list_allowed_methods = ['get']
        fields = ['id', 'name']
        authentication = SentryAuthentication()
        authorization = TeamAuthorization()


class TeamMemberResource(ModelResource):
    user = fields.ToOneField(UserResource, 'user', full=True)
    # access = fields.CharField('type')

    class Meta:
        queryset = TeamMember.objects.all()
        include_resource_uri = False
        detail_allowed_methods = ['get']
        list_allowed_methods = []
        fields = ['user']
        authentication = SentryAuthentication()
        authorization = TeamBasedAuthorization()

    # def dehydrate_access(self, bundle):
    #     return bundle.obj.get_type_display()


class ProjectResource(ModelResource):
    slug = fields.CharField(attribute="slug", readonly=True)
    owner = fields.ToOneField(UserResource, 'owner', full=True, readonly=True)
    team = fields.ToOneField(TeamResource, 'team', full=True)

    class Meta:
        queryset = Project.objects.filter(status=0)
        detail_uri_name = 'slug'
        resource_name = 'project'
        fields = ['id', 'name']
        allowed_methods = ['get']
        authentication = SentryAuthentication()
        authorization = ProjectAuthorization()


class GroupResource(ModelResource):
    project = fields.ToOneField(ProjectResource, 'project', readonly=True)
    team = fields.ToOneField(TeamResource, 'team', readonly=True)
    message = fields.CharField('message', readonly=True)
    times_seen = fields.IntegerField('times_seen', readonly=True)
    last_seen = fields.DateTimeField('last_seen', readonly=True)
    first_seen = fields.DateTimeField('first_seen', readonly=True)
    latest_event = fields.ToOneField('sentry.api.EventResource', 'latest_event', readonly=True, full=True)
    # events = fields.ToManyField('sentry.api.EventResource', 'event_set')

    class Meta:
        queryset = Group.objects.all()
        resource_name = 'group'
        allowed_methods = ['get']
        fields = ['id']
        authentication = SentryAuthentication()
        authorization = ProjectBasedAuthorization()

    def full_dehydrate(self, bundle):
        # HACK:
        bundle.obj.team = bundle.obj.project.team
        bundle.obj.latest_event = bundle.obj.get_latest_event()
        return super(GroupResource, self).full_dehydrate(bundle)


class EventResource(ModelResource):
    group = fields.ToOneField(GroupResource, 'group', readonly=True)
    project = fields.ToOneField(ProjectResource, 'project', readonly=True)
    message = fields.CharField('message', readonly=True)
    # data = fields.DictField(readonly=True)
    datetime = fields.DateTimeField('datetime', readonly=True)

    class Meta:
        queryset = Event.objects.all()
        resource_name = 'event'
        allowed_methods = ['get']
        fields = ['id']
        authentication = SentryAuthentication()
        authorization = ProjectBasedAuthorization()

    # def dehydrate_data(self, bundle):
    #     return bundle.obj.data


v1_api = Api(api_name='v1')
v1_api.register(TeamResource())
v1_api.register(TeamMemberResource())
v1_api.register(ProjectResource())
v1_api.register(GroupResource())
v1_api.register(EventResource())
