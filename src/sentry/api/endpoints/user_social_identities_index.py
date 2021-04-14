from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from social_auth.models import UserSocialAuth


class UserSocialIdentitiesIndexEndpoint(UserEndpoint):
    def get(self, request, user):
        """
        List Account's Identities
        `````````````````````````

        List an account's associated identities (e.g. github when trying to add a repo)

        :auth: required
        """

        identity_list = list(UserSocialAuth.objects.filter(user=user))
        return Response(serialize(identity_list))
