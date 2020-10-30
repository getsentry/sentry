from __future__ import absolute_import

from django.db import transaction

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint, SessionAuthentication
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import ApiApplicationStatus, ApiAuthorization, ApiToken


class ApiAuthorizationsEndpoint(Endpoint):
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        queryset = ApiAuthorization.objects.filter(
            user=request.user, application__status=ApiApplicationStatus.active
        ).select_related("application")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="application__name",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def delete(self, request):
        authorization = request.data.get("authorization")
        if not authorization:
            return Response({"authorization": ""}, status=400)

        try:
            auth = ApiAuthorization.objects.get(user=request.user, id=authorization)
        except ApiAuthorization.DoesNotExist:
            return Response(status=404)

        with transaction.atomic():
            ApiToken.objects.filter(user=request.user, application=auth.application_id).delete()

            auth.delete()

        return Response(status=204)
