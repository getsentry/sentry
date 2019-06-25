from __future__ import absolute_import

import logging

from datetime import timedelta
from django.utils import timezone
from graphene_django import DjangoObjectType

from sentry.api.event_search import get_snuba_query_args
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases.group import GroupPermission
from sentry.api.bases.project import ProjectPermission, ProjectEventPermission
from sentry.models import Group, Organization, Project
from sentry.models.event import SnubaEvent
from sentry.utils.snuba import raw_query
import graphene


class OrgStatus(graphene.Enum):
    ACTIVE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


class OrganizationType(DjangoObjectType):
    class Meta:
        model = Organization
        only_fields = ('slug', 'name', 'status',
                       'date_added', 'default_role', 'flags', 'project_set')

    status = graphene.Field(OrgStatus)

    def resolve_project_set(parent, info):
        projects = Project.objects.filter(
            organization=parent,
        )
        permissions = ProjectPermission()
        projects = filter(
            lambda p: permissions.has_object_permission(
                info.context, None, p), projects)
        return projects

    def resolve_status(parent, info):
        return parent.status


class ProjectStatusType(graphene.Enum):
    VISIBLE = 0
    HIDDEN = 1
    PENDING_DELETION = 2
    DELETION_IN_PROGRESS = 3


class ProjectType(DjangoObjectType):
    class Meta:
        model = Project
        only_fields = ('id', 'slug', 'name', 'date_added', 'status',
                       'platform', 'organization', 'group_set')

    status = graphene.Field(ProjectStatusType)

    def resolve_status(parent, info):
        return parent.status

    def resolve_group_set(parent, info):
        permissions = ProjectEventPermission()
        if not permissions.has_object_permission(info.context, None, parent):
            return []

        return Group.objects.filter(
            project=parent,
        )


class EventType(graphene.ObjectType):
    id = graphene.String()
    title = graphene.String()
    size = graphene.Int()
    dist = graphene.String()
    message = graphene.String()
    title = graphene.String()
    location = graphene.String()
    culprit = graphene.String()
    user = graphene.String()
    event_type = graphene.String()
    platform = graphene.String()
    date_created = graphene.DateTime()
    fingerprints = graphene.List(graphene.String)
    tags = graphene.List(graphene.String)

    issue = graphene.Field('sentry.api.graphql.IssueType')

    def resolve_event_type(self, info):
        return self.get_event_type()

    def resolve_date_created(self, info):
        return self.datetime

    def resolve_fingerprints(self, info):
        return self.get_hashes()

    def resolve_tags(self, info):
        return self.get_tags()

    def resolve_issue(self, info):
        g = Group.objects.get(id=self.group_id)
        permissions = GroupPermission()
        if not permissions.has_object_permission(info.context, None, g):
            return None
        return g


class GroupType(graphene.Enum):
    UNRESOLVED = 0
    RESOLVED = 1
    IGNORED = 2
    PENDING_DELETION = 3
    DELETION_IN_PROGRESS = 4
    PENDING_MERGE = 5


class GroupLevelType(graphene.Enum):
    SAMPLE = logging.NOTSET
    DEBUG = logging.DEBUG
    INFO = logging.INFO
    WARNING = logging.WARNING
    ERROR = logging.ERROR
    FATAL = logging.FATAL


class IssueType(DjangoObjectType):

    evt_type = graphene.String()
    events = graphene.List(EventType)

    class Meta:
        model = Group
        only_fields = ('id', 'short_id', 'message', 'culprit', 'logger', 'level',
                       'platform', 'project', 'times_seen', 'last_seen', 'first_seen',
                       'resolved_at', 'active_at', 'time_spent_total',
                       'time_spent_count', 'status')

    status = graphene.Field(GroupType)
    level = graphene.Field(GroupLevelType)

    def resolve_status(parent, info):
        return parent.status

    def resolve_level(parent, info):
        return parent.level

    def resolve_evt_type(self, info):
        return self.get_event_type()

    def resolve_events(self, info):
        default_end = timezone.now()
        default_start = default_end - timedelta(days=90)
        params = {
            'issue.id': [self.id],
            'project_id': [self.project_id],
            'start': default_start,
            'end': default_end,
        }
        snuba_args = get_snuba_query_args(None, params)
        snuba_cols = SnubaEvent.minimal_columns
        ret = raw_query(
            selected_columns=snuba_cols,
            orderby='-timestamp',
            referrer='api.graphql',
            **snuba_args
        )
        return [SnubaEvent(row) for row in ret['data']]


class Query(graphene.ObjectType):
    organization = graphene.Field(
        OrganizationType,
        slug=graphene.String(),  # Slug is probably its own type
    )
    issue = graphene.Field(
        IssueType,
        id=graphene.String(),
    )
    event = graphene.Field(
        EventType,
        id=graphene.String(),
        project_id=graphene.Int(),
    )

    def resolve_organization(self, info, **kwargs):
        slug = kwargs.get('slug')
        if not slug:
            return None

        org = Organization.objects.get_from_cache(
            slug=slug,
        )

        if not org:
            return None

        permissions = OrganizationPermission()
        has_permission = permissions.has_object_permission(info.context, None, org)

        return org if has_permission else None

    def resolve_issue(self, info, **kwargs):
        id = kwargs.get('id')
        if not id:
            return None

        return Group.objects.get(id=id)

    def resolve_event(self, info, **kwargs):
        id = kwargs.get('id')
        project_id = kwargs.get('project_id')
        if not id or not project_id:
            return None
        event = SnubaEvent.get_event(project_id, id)
        permissions = GroupPermission()
        g = Group.objects.get(id=event.group_id)
        has_permission = permissions.has_object_permission(info.context, None, g)
        return event if has_permission else None


schema = graphene.Schema(query=Query)
