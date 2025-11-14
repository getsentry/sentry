from typing import int
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.auth_v2.endpoints.base import AuthV2Endpoint
from sentry.users.api.serializers.user import UserSerializerWithOrgMemberships
from sentry.users.models.user import User
from sentry.users.models.user_merge_verification_code import UserMergeVerificationCode


class AuthMergeUserAccountsValidator(CamelSnakeSerializer):
    verification_code = serializers.CharField(required=True)
    ids_to_merge = serializers.ListField(child=serializers.IntegerField(), required=True)
    ids_to_delete = serializers.ListField(child=serializers.IntegerField(), required=True)


@control_silo_endpoint
class AuthMergeUserAccountsEndpoint(AuthV2Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    """
    List and merge user accounts with the same primary email address.
    """

    def get(self, request: Request) -> Response:
        user = request.user
        if not user.is_authenticated:
            return Response(status=401)

        shared_email = user.email
        if not shared_email:
            return Response(
                status=400,
                data={"error": "Shared email is empty or null"},
            )
        queryset = User.objects.filter(email=shared_email).order_by("last_active")
        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, user, UserSerializerWithOrgMemberships()),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request) -> Response:
        if not request.user.is_authenticated:
            return Response(status=401)

        validator = AuthMergeUserAccountsValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=400)
        result = validator.validated_data

        primary_user = User.objects.get(id=request.user.id)
        verification_code = UserMergeVerificationCode.objects.filter(
            user_id=primary_user.id
        ).first()
        if verification_code is None or verification_code.token != result["verification_code"]:
            return Response(
                status=403,
                data={"error": "Incorrect verification code"},
            )

        ids_to_merge = result["ids_to_merge"]
        ids_to_delete = result["ids_to_delete"]
        if not set(ids_to_merge).isdisjoint(set(ids_to_delete)):
            return Response(
                status=400,
                data={
                    "error": "The set of IDs to merge and the set of IDs to delete must be disjoint"
                },
            )
        if primary_user.id in ids_to_merge or primary_user.id in ids_to_delete:
            return Response(
                status=400,
                data={"error": "You may not merge the user attached to your current session"},
            )
        shared_email = primary_user.email
        affected_user_emails = User.objects.filter(
            id__in=(ids_to_delete + ids_to_merge)
        ).values_list("email", flat=True)

        if any(email != shared_email for email in affected_user_emails):
            return Response(
                status=403,
                data={
                    "error": "One or more of the accounts in your request does not share your primary email address"
                },
            )

        users_to_delete = User.objects.filter(id__in=ids_to_delete)
        for user in users_to_delete:
            user.delete()

        users_to_merge = User.objects.filter(id__in=ids_to_merge)
        for user in users_to_merge:
            user.merge_to(primary_user)
            user.delete()

        return Response(serialize([primary_user], request.user, UserSerializerWithOrgMemberships()))
