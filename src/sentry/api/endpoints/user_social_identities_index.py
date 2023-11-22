from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from social_auth.models import UserSocialAuth


@control_silo_endpoint
class UserSocialIdentitiesIndexEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.ENTERPRISE

    def get(self, request: Request, user) -> Response:
        """
        List Account's Identities
        `````````````````````````

        List an account's associated identities (e.g. github when trying to add a repo)

        :auth: required
        """

        identity_list = list(UserSocialAuth.objects.filter(user=user))
        return Response(serialize(identity_list))
