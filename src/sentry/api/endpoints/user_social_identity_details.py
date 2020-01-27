from __future__ import absolute_import

import logging

from django.conf import settings
from rest_framework.response import Response
from social_core.backends.utils import get_backend
from social_core.actions import do_disconnect
from social_django.models import UserSocialAuth

from sentry.api.bases.user import UserEndpoint

logger = logging.getLogger("sentry.accounts")


class UserSocialIdentityDetailsEndpoint(UserEndpoint):
    def delete(self, request, user, identity_id):
        """
        Disconnect a Identity from Account
        ```````````````````````````````````````````````````````

        Disconnects a social auth identity from a sentry account

        :pparam string identity_id: identity id
        :auth: required
        """

        try:
            auth = UserSocialAuth.objects.get(id=identity_id)
        except UserSocialAuth.DoesNotExist:
            return Response(status=404)

        backend = get_backend(settings.AUTHENTICATION_BACKENDS, auth.provider)
        if backend is None:
            raise Exception(u"Backend was not found for request: {}".format(auth.provider))

        do_disconnect(backend, user)

        # XXX(dcramer): we experienced an issue where the identity still existed,
        # and given that this is a cheap query, lets error hard in that case
        assert not UserSocialAuth.objects.filter(user=user, id=identity_id).exists()

        logger.info(
            "user.identity.disconnect",
            extra={
                "user_id": user.id,
                "ip_address": request.META["REMOTE_ADDR"],
                "usersocialauth_id": identity_id,
            },
        )

        return Response(status=204)
