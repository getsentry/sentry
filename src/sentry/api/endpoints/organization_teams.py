from __future__ import absolute_import

import six
import sentry_sdk

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils.translation import ugettext_lazy as _
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models import team as team_serializers
from sentry.models import (
    AuditLogEntryEvent,
    OrganizationMember,
    OrganizationMemberTeam,
    Team,
    TeamStatus,
)
from sentry.search.utils import tokenize_query
from sentry.signals import team_created

CONFLICTING_SLUG_ERROR = "A team with this slug already exists."


# OrganizationPermission + team:write
class OrganizationTeamsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:write", "org:admin", "team:write"],
        "PUT": ["org:write", "org:admin", "team:write"],
        "DELETE": ["org:admin", "team:write"],
    }


class TeamSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False, allow_null=True, allow_blank=True)
    slug = serializers.RegexField(
        r"^[a-z0-9_\-]+$",
        max_length=50,
        required=False,
        allow_null=True,
        error_messages={
            "invalid": _(
                "Enter a valid slug consisting of lowercase letters, "
                "numbers, underscores or hyphens."
            )
        },
    )

    def validate(self, attrs):
        if not (attrs.get("name") or attrs.get("slug")):
            raise serializers.ValidationError("Name or slug is required")
        return attrs


class OrganizationTeamsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationTeamsPermission,)

    def get(self, request, organization):
        """
        List an Organization's Teams
        ````````````````````````````

        Return a list of teams bound to a organization.

        :pparam string organization_slug: the slug of the organization for
                                          which the teams should be listed.
        :param string detailed:      Specify "0" to return team details that do not include projects
        :param string is_not_member: Specify "1" to *only* return team details of teams that user is not a member of
        :auth: required
        """
        # TODO(dcramer): this should be system-wide default for organization
        # based endpoints
        if request.auth and hasattr(request.auth, "project"):
            return Response(status=403)

        with sentry_sdk.start_span(op="PERF: OrgTeam.get - filter"):
            queryset = Team.objects.filter(
                organization=organization, status=TeamStatus.VISIBLE
            ).order_by("slug")

        if request.GET.get("is_not_member", "0") == "1":
            user_teams = Team.objects.get_for_user(organization=organization, user=request.user)
            queryset = queryset.exclude(id__in=[ut.id for ut in user_teams])

        query = request.GET.get("query")

        with sentry_sdk.start_span(op="PERF: OrgTeam.get - tokenize"):
            if query:
                tokens = tokenize_query(query)
                for key, value in six.iteritems(tokens):
                    if key == "query":
                        value = " ".join(value)
                        queryset = queryset.filter(
                            Q(name__icontains=value) | Q(slug__icontains=value)
                        )
                    else:
                        queryset = queryset.none()

        is_detailed = request.GET.get("detailed", "1") != "0"

        with sentry_sdk.start_span(op="PERF: OrgTeam.get - serialize"):
            serializer = (
                team_serializers.TeamWithProjectsSerializer
                if is_detailed
                else team_serializers.TeamSerializer
            )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="slug",
            on_results=lambda x: serialize(x, request.user, serializer()),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request, organization):
        """
        Create a new Team
        ``````````````````

        Create a new team bound to an organization.  Only the name of the
        team is needed to create it, the slug can be auto generated.

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :param string name: the optional name of the team.
        :param string slug: the optional slug for this team.  If
                            not provided it will be auto generated from the
                            name.
        :auth: required
        """
        serializer = TeamSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            try:
                with transaction.atomic():
                    team = Team.objects.create(
                        name=result.get("name") or result["slug"],
                        slug=result.get("slug"),
                        organization=organization,
                    )
            except IntegrityError:
                return Response(
                    {
                        "non_field_errors": [CONFLICTING_SLUG_ERROR],
                        "detail": CONFLICTING_SLUG_ERROR,
                    },
                    status=409,
                )
            else:
                team_created.send_robust(
                    organization=organization, user=request.user, team=team, sender=self.__class__
                )

            if request.user.is_authenticated():
                try:
                    member = OrganizationMember.objects.get(
                        user=request.user, organization=organization
                    )
                except OrganizationMember.DoesNotExist:
                    pass
                else:
                    OrganizationMemberTeam.objects.create(team=team, organizationmember=member)

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_ADD,
                data=team.get_audit_log_data(),
            )

            return Response(serialize(team, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
