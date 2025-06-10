from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers import serialize
from sentry.users.api.serializers.user import UserSerializerWithOrgMemberships
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail


@control_silo_endpoint
class AuthMergeUserAccountsEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SentryIsAuthenticated,)
    """
    List and merge user accounts with the same primary email address.
    """

    def get(self, request: Request) -> Response:
        user = request.user
        if isinstance(user, AnonymousUser):
            return Response(
                status=401,
                data={"error": "You must be authenticated to use this endpoint"},
            )

        shared_email = user.email
        queryset = User.objects.filter(email=shared_email).order_by("last_active")
        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, user, UserSerializerWithOrgMemberships()),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request) -> Response:
        user = request.user
        if isinstance(user, AnonymousUser):
            return Response(
                status=401,
                data={"error": "You must be authenticated to use this endpoint"},
            )

        primary_user = User.objects.get(id=user.id)
        user_email = UserEmail.objects.get(user_id=primary_user.id, email=primary_user.email)
        if not user_email.is_verified:
            return Response(
                status=403,
                data={"error": "You must verify your primary email address to use this endpoint"},
            )

        ids_to_delete = request.data.get("ids_to_delete", [])
        ids_to_merge = request.data.get("ids_to_merge", [])
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

        return Response("Successfully merged user accounts.")
