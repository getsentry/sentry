from rest_framework.response import Response

from sentry.api.authentication import RelayAuthentication
from sentry.api.base import Endpoint
from sentry.api.permissions import RelayPermission
from sentry.models import ProjectKey


class RelayProjectIdsEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RelayPermission,)

    def post(self, request):
        relay = request.relay
        assert relay is not None  # should be provided during Authentication

        project_ids = {}
        for public_key in request.relay_request_data.get("publicKeys") or ():
            if not ProjectKey.looks_like_api_key(public_key):
                continue

            try:
                pk = ProjectKey.objects.get_from_cache(public_key=public_key)
            except ProjectKey.DoesNotExist:
                continue

            # NB: Do not validate pk here (is_active or store). Relay should
            # also receive a mapping for disabled public keys and then perform
            # the full project config fetch.

            project_ids[public_key] = pk.project_id

        return Response({"projectIds": project_ids}, status=200)
