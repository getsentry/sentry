from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.utils.snuba import raw_query


@region_silo_endpoint
class GroupByHashEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project, hash) -> Response:
        """
        List an issues details given its hash
        ``````````````````````

        This endpoint lists information about an issue given its hash, which are the generated
        checksums used to aggregate individual events.

        :pparam string hash: the hash of the issue to retrieve.
        :auth: required
        """

        rv = raw_query(
            selected_columns=["group_id", "hash", "project_id"],
            filter_keys={"project_id": [project.id], "hash": [hash]},
            referrer="api.group-by-hash",
        )
        return rv[0]
