from django.db import IntegrityError, router, transaction
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.groupsearchview import GroupSearchView, GroupSearchViewVisibility
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

        try:
            gsvs = GroupSearchView.objects.filter(
                organization=self.context["organization"], id__in=view_ids
            )
            # This should never happen, but we can check just in case
            if any(
                gsv.user_id != self.context["user"].id
                and gsv.visibility != GroupSearchViewVisibility.ORGANIZATION
                for gsv in gsvs
            ):
                raise serializers.ValidationError("You do not have access to one or more views")
        except IntegrityError as e:
            raise serializers.ValidationError("One or more views do not exist") from e

        return view_ids


@region_silo_endpoint
class OrganizationGroupSearchViewStarredOrderEndpoint(OrganizationEndpoint):
    publish_status = {"PUT": ApiPublishStatus.EXPERIMENTAL}
    owner = ApiOwner.ISSUES
    permission_classes = (MemberPermission,)

    def put(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:issue-view-sharing", organization, actor=request.user):
            return Response(status=status.HTTP_400_BAD_REQUEST)

        serializer = GroupSearchViewStarredOrderSerializer(
            data=request.data, context={"organization": organization, "user": request.user}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        view_ids = serializer.validated_data["view_ids"]

        try:
            with transaction.atomic(using=router.db_for_write(GroupSearchViewStarred)):
                _update_view_positions(organization, request.user.id, view_ids)
        except IntegrityError as e:
            return Response(status=status.HTTP_400_BAD_REQUEST, data={"detail": e.args[0]})

        return Response(status=status.HTTP_204_NO_CONTENT)


def _update_view_positions(organization: Organization, user_id: int, view_positions: list[int]):
    GroupSearchViewStarred.objects.filter(organization=organization, user_id=user_id).exclude(
        group_search_view_id__in=view_positions
    ).delete()

    existing_starred_views = GroupSearchViewStarred.objects.filter(
        organization=organization, user_id=user_id, group_search_view_id__in=view_positions
    )
    existing_starred_views_dict = {
        starred_view.group_search_view_id: starred_view for starred_view in existing_starred_views
    }

    for idx, view_id in enumerate(view_positions):
        if view_id in existing_starred_views_dict:
            existing_starred_views_dict[view_id].position = idx
            existing_starred_views_dict[view_id].save()
        else:
            try:
                GroupSearchViewStarred.objects.create(
                    organization=organization,
                    user_id=user_id,
                    group_search_view_id=view_id,
                    position=idx,
                )
            except IntegrityError as e:
                raise IntegrityError(e)
