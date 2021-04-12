from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases import GroupEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializerSnuba


class GroupFirstLastReleaseEndpoint(GroupEndpoint, EnvironmentMixin):
    def get(self, request, group):
        """Get the first and last release for the group.

        This data used to be returned by default in group_details.py, but now that we
        can collapse it, we're providing this endpoint to fetch the data separately.
        """
        organization = group.project.organization
        environments = get_environments(request, organization)
        environment_ids = [e.id for e in environments]
        # WARNING: the rest of this endpoint relies on this serializer
        # populating the cache SO don't move this :)
        data = serialize(group, request.user, GroupSerializerSnuba(environment_ids=environment_ids))
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
