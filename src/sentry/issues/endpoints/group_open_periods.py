from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint

# from sentry.api.serializers import serialize
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.group import Group
from sentry.models.groupopenperiod import get_open_periods_for_group

OPEN_PERIOD_LIMIT = 50
# ACTIVITY_LIMIT = 50


@region_silo_endpoint
class GroupOpenPeriodsEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, group: Group) -> Response:
        """
        Retrieve all open periods and their activities for a Group
        """
        open_periods = get_open_periods_for_group(group, limit=OPEN_PERIOD_LIMIT)
        # TODO add groupopenperiodactivity data per openperiod once that table exists
        data = {"openPeriods": [open_period.to_dict() for open_period in open_periods]}
        return Response(data)
