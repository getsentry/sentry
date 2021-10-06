from collections import defaultdict

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.bases import KeyTransactionBase
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.helpers.teams import get_teams
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.utils import InvalidParams
from sentry.discover.endpoints import serializers
from sentry.discover.models import TeamKeyTransaction
from sentry.models import ProjectTeam, Team


class KeyTransactionPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
        "PUT": ["org:read"],
        "DELETE": ["org:read"],
    }


class KeyTransactionEndpoint(KeyTransactionBase):
    permission_classes = (KeyTransactionPermission,)

    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        transaction_name = request.GET.get("transaction")
        if transaction_name is None:
            raise ParseError(detail="A transaction name is required")

        project = self.get_project(request, organization)
        teams = Team.objects.get_for_user(organization, request.user)

        key_teams = TeamKeyTransaction.objects.filter(
            organization=organization,
            project_team__in=ProjectTeam.objects.filter(team__in=teams, project=project),
            transaction=transaction_name,
        ).order_by("project_team__team_id")

        return Response(serialize(list(key_teams)), status=200)

    def post(self, request, organization):
        """Create a Key Transaction"""
        if not self.has_feature(organization, request):
            return Response(status=404)

        project = self.get_project(request, organization)

        with transaction.atomic():
            serializer = serializers.TeamKeyTransactionSerializer(
                data=request.data,
                context={
                    "mode": "create",
                    "request": request,
                    "organization": organization,
                },
            )

            if serializer.is_valid():
                data = serializer.validated_data
                base_filter = {
                    "organization": organization,
                    "transaction": data["transaction"],
                }

                project_teams = ProjectTeam.objects.filter(project=project, team__in=data["team"])
                if len(project_teams) < len(data["team"]):
                    # some teams do not have access to the specified project
                    return Response({"detail": "Team does not have access to project"}, status=400)

                keyed_transaction_team_ids = set(
                    TeamKeyTransaction.objects.values_list(
                        "project_team__team_id", flat=True
                    ).filter(**base_filter, project_team__in=project_teams)
                )
                if len(keyed_transaction_team_ids) == len(data["team"]):
                    # all teams already have the specified transaction marked as key
                    return Response(status=204)

                try:
                    unkeyed_project_teams = project_teams.exclude(
                        team_id__in=keyed_transaction_team_ids
                    )
                    TeamKeyTransaction.objects.bulk_create(
                        [
                            TeamKeyTransaction(**base_filter, project_team=project_team)
                            for project_team in unkeyed_project_teams
                        ]
                    )
                    return Response(status=201)
                # Even though we tried to avoid it, the TeamKeyTransaction was created already
                except IntegrityError:
                    return Response(status=409)

        return Response(serializer.errors, status=400)

    def delete(self, request, organization):
        """Remove a Key transaction for a user"""
        if not self.has_feature(organization, request):
            return Response(status=404)

        project = self.get_project(request, organization)

        serializer = serializers.TeamKeyTransactionSerializer(
            data=request.data,
            context={
                "request": request,
                "organization": organization,
            },
        )

        if serializer.is_valid():
            data = serializer.validated_data

            TeamKeyTransaction.objects.filter(
                organization=organization,
                project_team__in=ProjectTeam.objects.filter(project=project, team__in=data["team"]),
                transaction=data["transaction"],
            ).delete()

            return Response(status=204)

        return Response(serializer.errors, status=400)


class KeyTransactionListEndpoint(KeyTransactionBase):
    permission_classes = (KeyTransactionPermission,)

    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            teams = get_teams(request, organization)
        except InvalidParams as err:
            return Response(str(err), status=400)

        projects = self.get_projects(request, organization)

        serializer = KeyTransactionTeamSerializer(projects)

        return self.paginate(
            request=request,
            queryset=teams,
            order_by="slug",
            on_results=lambda x: serialize(x, request.user, serializer),
            paginator_cls=OffsetPaginator,
        )


@register(TeamKeyTransaction)
class TeamKeyTransactionSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "team": str(obj.project_team.team_id),
        }


class KeyTransactionTeamSerializer(Serializer):
    def __init__(self, projects):
        self.project_ids = {project.id for project in projects}

    def get_attrs(self, item_list, user, **kwargs):
        team_key_transactions = (
            TeamKeyTransaction.objects.filter(
                project_team__in=ProjectTeam.objects.filter(team__in=item_list),
            )
            .select_related("project_team__project", "project_team__team")
            .order_by("transaction", "project_team__project_id")
        )

        attrs = defaultdict(
            lambda: {
                "count": 0,
                "key_transactions": [],
            }
        )

        for kt in team_key_transactions:
            team = kt.project_team.team
            project = kt.project_team.project
            attrs[team]["count"] += 1
            if project.id in self.project_ids:
                attrs[team]["key_transactions"].append(
                    {
                        "project_id": str(project.id),
                        "transaction": kt.transaction,
                    }
                )

        return attrs

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "team": str(obj.id),
            "count": attrs.get("count", 0),
            "keyed": attrs.get("key_transactions", []),
        }
