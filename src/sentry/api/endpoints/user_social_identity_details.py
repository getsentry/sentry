from __future__ import absolute_import

import logging

from rest_framework.response import Response
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

        # HACK(joshuarli): I've tried every method i could come up with to call social
        # auth's disconnect, but for reasons i fail to understand, the backend object
        # (e.g. AsanaOAuth2) is strange while it's going through social auth's disconnect
        # code. For example, you might run into it not having the "strategy" attribute,
        # which I hacked around with:
        #
        #   class AsanaOAuth2(_AsanaOAuth2):
        #   +     strategy = load_strategy()
        #
        # But then you'll likely encounter:
        # unbound method setting() must be called with AsanaOAuth2 instance as first argument
        # (got str instance instead)
        #
        # And then I haven't been able to figure out how to get past that.
        # What essentially needs to happen is that the UserSocialAuth needs to be deleted,
        # which is IMO a better hack than improperly using social auth disconnect.
        # The only thing we'll lose from this approach is SOCIAL_AUTH_REVOKE_TOKENS_ON_DISCONNECT,
        # but I don't see that being much of an issue as tokens (at least for asana) expire after an hour.
        auth.delete()

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
