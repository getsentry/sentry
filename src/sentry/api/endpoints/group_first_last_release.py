from rest_framework.response import Response

from sentry.api.endpoints.group_details import GroupDetailsEndpoint
from sentry.api.helpers.group_index import rate_limit_endpoint


class GroupFirstLastReleaseEndpoint(GroupDetailsEndpoint):
    @rate_limit_endpoint(limit=5, window=1)
    def get(self, request, group):
        """Get the first and last release for the group.

        This data used to be returned by default in group_details.py, but now that we
        can collapse it, we're providing this endpoint to fetch the data separately.
        """
        first_release, last_release = self._get_first_last_release(request, group)
        data = {
            "id": str(group.id),
            "firstRelease": first_release,
            "lastRelease": last_release,
        }
        return Response(data)

    @rate_limit_endpoint(limit=5, window=1)
    def put(self, request, group):
        return Response(status=404)

    @rate_limit_endpoint(limit=5, window=1)
    def delete(self, request, group):
        return Response(status=404)
