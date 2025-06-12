from django.db import IntegrityError, router, transaction
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization


class MemberPermission(OrganizationPermission):
    scope_map = {
        "PUT": ["member:read", "member:write"],
    }


class GroupSearchViewStarredOrderSerializer(serializers.Serializer):
    view_ids = serializers.ListField(child=serializers.IntegerField(), required=True, min_length=0)

    def validate_view_ids(self, view_ids):
        if len(view_ids) != len(set(view_ids)):
            raise serializers.ValidationError("Single view cannot take up multiple positions")

        return view_ids


@region_silo_endpoint
class OrganizationGroupSearchViewStarredOrderEndpoint(OrganizationEndpoint):
    publish_status = {"PUT": ApiPublishStatus.EXPERIMENTAL}
    owner = ApiOwner.ISSUES
    permission_classes = (MemberPermission,)

    def put(self, request: Request, organization: Organization) -> Response:
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        serializer = GroupSearchViewStarredOrderSerializer(
            data=request.data, context={"organization": organization, "user": request.user}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        view_ids = serializer.validated_data["view_ids"]

        try:
            with transaction.atomic(using=router.db_for_write(GroupSearchViewStarred)):
                GroupSearchViewStarred.objects.reorder_starred_views(
                    organization=organization,
                    user_id=request.user.id,
                    new_view_positions=view_ids,
                )
        except IntegrityError as e:
            return Response(status=status.HTTP_400_BAD_REQUEST, data={"detail": e.args[0]})
        except ValueError as e:
            return Response(status=status.HTTP_400_BAD_REQUEST, data={"detail": e.args[0]})

        return Response(status=status.HTTP_204_NO_CONTENT)
