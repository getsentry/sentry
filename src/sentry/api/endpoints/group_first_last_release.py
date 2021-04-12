from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases import GroupEndpoint


class GroupFirstLastReleaseEndpoint(GroupEndpoint, EnvironmentMixin):
    def get(self, request, group):
        """Get the first and last release for the group.

        This data used to be returned by default in group_details.py, but now that we
        can collapse it, we're providing this endpoint to fetch the data separately.
        """
        first_release = group.get_first_release()
        if first_release is not None:
            last_release = group.get_last_release()
        else:
            last_release = None

        if first_release is not None and last_release is not None:
            first_release, last_release = self._get_first_last_release_info(
                request, group, [first_release, last_release]
            )
        elif first_release is not None:
            first_release = self._get_release_info(request, group, first_release)
        elif last_release is not None:
            last_release = self._get_release_info(request, group, last_release)
        data = {
            "id": str(group.id),
            "firstRelease": first_release,
            "lastRelease": last_release,
        }
        return Response(data)
