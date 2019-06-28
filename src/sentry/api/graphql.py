from __future__ import absolute_import

from sentry.api.graphql_query import QueryMaster
from sentry.api.graphql_type import SentryGraphQLType
from sentry.api.graphql_simple import SentryGraphQLSimpleType
from sentry.models import Group, Organization, Project
from sentry.models.event import SnubaEvent
import graphene


class OrganizationType(SentryGraphQLType):
    class Meta:
        model = Organization


class ProjectType(SentryGraphQLType):
    class Meta:
        model = Project


class GroupType(SentryGraphQLType):
    class Meta:
        model = Group


class EventType(SentryGraphQLSimpleType):
    class Meta:
        model = SnubaEvent


class Query(QueryMaster):
    from sentry.api.graphql import OrganizationType
    from sentry.api.graphql import GroupType
    from sentry.api.graphql import EventType
    graphql_types = [
        OrganizationType,
        GroupType,
        EventType,
    ]


schema = graphene.Schema(query=Query)
