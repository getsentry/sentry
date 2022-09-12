from datetime import timedelta

from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models.deploy import Deploy
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.release import Release
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class GroupSuspectReleasesEndpoint(GroupEndpoint, EnvironmentMixin):
    private = True
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
        suspect_releases = set()
        regression = (
            GroupHistory.objects.filter(group=group, status=GroupHistoryStatus.REGRESSED)
            .order_by("-date_added")
            .first()
        )

        latest_regression_date = None
        if regression and regression.release:
            suspect_releases.add(regression.release)
        else:
            latest_regression_date = regression.date_added if regression else None

        first_seen = group.first_seen
        deploy_filter = Q(
            date_finished__gt=first_seen - timedelta(hours=1),
            date_finished__lte=first_seen,
        )
        if latest_regression_date:
            deploy_filter |= Q(
                date_finished__gt=latest_regression_date - timedelta(hours=1),
                date_finished__lte=latest_regression_date,
            )

        deploys = Deploy.objects.filter(
            deploy_filter,
            organization_id=organization.id,
            release__projects__in=[group.project],
        ).select_related("release")
        suspect_releases.update({deploy.release for deploy in deploys})

        releases = Release.objects.filter(
            projects__in=[group.project],
            date_released__gt=first_seen - timedelta(hours=1),
            date_released__lte=first_seen,
        )
        suspect_releases.update(releases)

        suspect_releases = serialize(suspect_releases, request.user)
        data = list(sorted(suspect_releases, key=lambda x: x["dateCreated"], reverse=True))
        return Response(data)
