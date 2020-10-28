from __future__ import absolute_import

from rest_framework.response import Response
from rest_framework import status
from django.http import Http404

from sentry.api.bases import SentryInternalAppTokenPermission, SentryAppBaseEndpoint
from sentry.models import ApiToken
from sentry.mediators.sentry_app_installation_tokens import Destroyer


class SentryInternalAppTokenDetailsEndpoint(SentryAppBaseEndpoint):
    permission_classes = (SentryInternalAppTokenPermission,)

    def convert_args(self, request, sentry_app_slug, api_token, *args, **kwargs):
        # get the sentry_app from the SentryAppBaseEndpoint class
        (args, kwargs) = super(SentryInternalAppTokenDetailsEndpoint, self).convert_args(
            request, sentry_app_slug, *args, **kwargs
        )

        try:
            kwargs["api_token"] = ApiToken.objects.get(token=api_token)
        except ApiToken.DoesNotExist:
            raise Http404

        return (args, kwargs)

    def delete(self, request, sentry_app, api_token):
        # Validate the token is associated with the application
        if api_token.application_id != sentry_app.application_id:
            raise Http404

        if not sentry_app.is_internal:
            return Response(
                "This route is limited to internal integrations only",
                status=status.HTTP_403_FORBIDDEN,
            )

        Destroyer.run(api_token=api_token, user=request.user, request=request)

        return Response(status=204)
