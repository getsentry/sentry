from django.db import IntegrityError, transaction
from django.db.models import Count
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.bases import KeyTransactionBase
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.helpers.teams import get_teams
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.utils import InvalidParams
from sentry.discover.endpoints import serializers
from sentry.discover.models import KeyTransaction, TeamKeyTransaction
from sentry.models import Team


class KeyTransactionPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
        "PUT": ["org:read"],
        "DELETE": ["org:read"],
    }


class IsKeyTransactionEndpoint(KeyTransactionBase):
    permission_classes = (KeyTransactionPermission,)

    def get(self, request, organization):
        """Get the Key Transactions for a user"""
        if not self.has_feature(request, organization):
            return Response(status=404)

        project = self.get_project(request, organization)

        transaction = request.GET.get("transaction")

        try:
            KeyTransaction.objects.get(
                organization=organization,
                owner=request.user,
                project=project,
                transaction=transaction,
            )
            return Response({"isKey": True}, status=200)
        except KeyTransaction.DoesNotExist:
            return Response({"isKey": False}, status=200)


class KeyTransactionEndpoint(KeyTransactionBase):
    permission_classes = (KeyTransactionPermission,)

    def get(self, request, organization):
        if not self.has_team_feature(request, organization):
            return Response(status=404)

        transaction_name = request.GET.get("transaction")
        if transaction_name is None:
            raise ParseError(detail="A transaction name is required")

        project = self.get_project(request, organization)

        key_teams = TeamKeyTransaction.objects.filter(
            organization=organization,
            team__in=Team.objects.get_for_user(organization, request.user),
            project=project,
            transaction=transaction_name,
        ).order_by("team_id")

        return Response(serialize(list(key_teams)), status=200)

    def post(self, request, organization):
        """Create a Key Transaction"""
        if not self.has_feature(request, organization):
            return Response(status=404)

        project = self.get_project(request, organization)

        if not self.has_team_feature(request, organization):
            base_filter = {"organization": organization, "owner": request.user}

            with transaction.atomic():
                serializer = serializers.KeyTransactionSerializer(
                    data=request.data, context=base_filter
                )
                if serializer.is_valid():
                    data = serializer.validated_data
                    base_filter["transaction"] = data["transaction"]
                    base_filter["project"] = project

                    if KeyTransaction.objects.filter(**base_filter).exists():
                        return Response(status=204)

                    try:
                        KeyTransaction.objects.create(**base_filter)
                        return Response(status=201)
                    # Even though we tried to avoid it, this KeyTransaction was created already
                    except IntegrityError:
                        return Response(status=204)
                return Response(serializer.errors, status=400)

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
                    "project": project,
                    "transaction": data["transaction"],
                }

                keyed_transaction_team_ids = set(
                    TeamKeyTransaction.objects.values_list("team_id", flat=True).filter(
                        **base_filter, team__in=data["team"]
                    )
                )
                if len(keyed_transaction_team_ids) == len(data["team"]):
                    return Response(status=204)

                try:
                    # TeamKeyTransaction.objects.create(**base_filter)
                    TeamKeyTransaction.objects.bulk_create(
                        [
                            TeamKeyTransaction(**base_filter, team=team)
                            for team in data["team"]
                            if team.id not in keyed_transaction_team_ids
                        ]
                    )
                    return Response(status=201)
                # Even though we tried to avoid it, the TeamKeyTransaction was created already
                except IntegrityError:
                    return Response(status=409)

        return Response(serializer.errors, status=400)

    def delete(self, request, organization):
        """Remove a Key transaction for a user"""
        if not self.has_feature(request, organization):
            return Response(status=404)

        project = self.get_project(request, organization)

        if not self.has_team_feature(request, organization):
            transaction = request.data["transaction"]
            try:
                model = KeyTransaction.objects.get(
                    transaction=transaction,
                    organization=organization,
                    project=project,
                    owner=request.user,
                )
            except KeyTransaction.DoesNotExist:
                return Response(status=204)

            model.delete()

            return Response(status=204)

        serializer = serializers.TeamKeyTransactionSerializer(
            data=request.data,
            context={
                "request": request,
                "organization": organization,
            },
        )

        if serializer.is_valid():
            data = serializer.validated_data
            base_filter = {
                "organization": organization,
                "project": project,
                "transaction": data["transaction"],
            }

            TeamKeyTransaction.objects.filter(**base_filter, team__in=data["team"]).delete()

            return Response(status=204)

        return Response(serializer.errors, status=400)


class KeyTransactionCountEndpoint(KeyTransactionBase):
    permission_classes = (KeyTransactionPermission,)

    def has_feature(self, request, organization):
        return super().has_feature(request, organization) and super().has_team_feature(
            request, organization
        )

    def get(self, request, organization):
        if not self.has_feature(request, organization):
            return Response(status=404)

        try:
            teams = get_teams(request, organization)
        except InvalidParams as err:
            return Response(str(err), status=400)

        return Response(
            serialize(list(teams), serializer=KeyTransactionTeamSerializer()), status=200
        )


@register(TeamKeyTransaction)
class TeamKeyTransactionSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "team": str(obj.team_id),
        }


class KeyTransactionTeamSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        counts = (
            TeamKeyTransaction.objects.values("team_id")
            .filter(team__in=[item.id for item in item_list])
            .annotate(count=Count("team_id"))
        )
        count_map = {}
        for count in counts:
            count_map[count["team_id"]] = count["count"]

        attrs = {}
        for item in item_list:
            attrs[item] = {"count": count_map.get(item.id, 0)}
        return attrs

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "team": str(obj.id),
            "count": attrs["count"],
        }
