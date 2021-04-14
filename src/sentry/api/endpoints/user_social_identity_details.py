import logging

from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from social_auth.backends import get_backend
from social_auth.models import UserSocialAuth

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

        backend = get_backend(auth.provider, request, "/")
        if backend is None:
            raise Exception(f"Backend was not found for request: {auth.provider}")

        # stop this from bubbling up errors to social-auth's middleware
        # XXX(dcramer): IM SO MAD ABOUT THIS
        try:
            backend.disconnect(user, identity_id)
        except Exception as exc:
            import sys

            exc_tb = sys.exc_info()[2]
            raise exc.with_traceback(exc_tb)
            del exc_tb

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
