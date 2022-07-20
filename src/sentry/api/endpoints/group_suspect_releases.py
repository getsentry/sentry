from datetime import timedelta

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases import GroupEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import GroupSerializerSnuba, serialize
from sentry.models.deploy import Deploy
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.release import Release
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class GroupSuspectReleasesEndpoint(GroupEndpoint, EnvironmentMixin):
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(5, 1),
            RateLimitCategory.USER: RateLimit(5, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(5, 1),
        },
    }

    def get(self, request: Request, group) -> Response:
        """
        Retrieve Suspect Releases for an Issue
        ``````````````````````````````````````

        Return the suspect releases for an issue. Suspect releases are defined
        as releases which caused the first seen issue or the latest regression
        during the active release window (1 hour).
        :pparam string issue_id: the ID of the issue to retrieve.
        :auth: required
        """

        organization = group.project.organization
        environment_ids = [e.id for e in get_environments(request, organization)]

        data = serialize(group, request.user, GroupSerializerSnuba(environment_ids=environment_ids))

        suspect_releases = set()
        regression = (
            GroupHistory.objects.filter(group=group, status=GroupHistoryStatus.REGRESSED)
            .order_by("-date_added")
            .first()
        )
        if regression:
            suspect_releases.add(regression.release)

        first_seen = group.first_seen
        deploys = Deploy.objects.filter(
            date_finished__gt=first_seen - timedelta(hours=1),
            date_finished__lte=first_seen,
        )
        if deploys.exists():
            suspect_releases.add(deploys.first().release)
        else:
            releases = Release.objects.filter(
                date_released__gt=first_seen - timedelta(hours=1),
                date_released__lte=first_seen,
            )
            if releases.exists():
                suspect_releases.add(releases)

        suspect_releases = [serialize(release, request.user) for release in suspect_releases]
        data.update(
            {
                "suspect_releases": list(
                    sorted(suspect_releases, key=lambda x: x["dateCreated"], reverse=True)
                ),
            }
        )
        return Response(data)
