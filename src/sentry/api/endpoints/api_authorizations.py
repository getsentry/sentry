from django.db import router, transaction
from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers import serialize
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken


@control_silo_endpoint
class ApiAuthorizationsEndpoint(Endpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    authentication_classes = (SessionAuthentication,)
    permission_classes = (SentryIsAuthenticated,)

    def get(self, request: Request) -> Response:
        queryset = ApiAuthorization.objects.filter(
            user_id=request.user.id, application__status=ApiApplicationStatus.active
        ).select_related("application")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="application__name",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def delete(self, request: Request) -> Response:
        authorization = request.data.get("authorization")
        if not authorization:
            return Response({"authorization": ""}, status=400)

        try:
            api_authorization = ApiAuthorization.objects.get(
                user_id=request.user.id, id=authorization
            )
        except ApiAuthorization.DoesNotExist:
            return Response(status=404)

        with outbox_context(transaction.atomic(using=router.db_for_write(ApiToken)), flush=False):
            for token in ApiToken.objects.filter(
                user_id=request.user.id,
                application=api_authorization.application_id,
                scoping_organization_id=api_authorization.organization_id,
            ):
                token.delete()

        # remove any grants that were created from this authorization
        # that may not have been exchanged for a token yet
        with outbox_context(transaction.atomic(using=router.db_for_write(ApiGrant)), flush=False):
            for grant in ApiGrant.objects.filter(
                user_id=request.user.id,
                application=api_authorization.application_id,
                organization_id=api_authorization.organization_id,
            ):
                grant.delete()

        with outbox_context(
            transaction.atomic(using=router.db_for_write(ApiAuthorization)), flush=False
        ):
            api_authorization.delete()

        return Response(status=204)
