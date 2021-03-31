import sentry_sdk
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases import GroupEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import serialize
from sentry.api.serializers.models.grouprelease import GroupReleaseWithStatsSerializer
from sentry.models import GroupRelease, ReleaseEnvironment, ReleaseProject


class GroupCurrentReleaseEndpoint(GroupEndpoint, EnvironmentMixin):
    def _get_current_release(self, group, environments):
        release_projects = ReleaseProject.objects.filter(project_id=group.project_id).values_list(
            "release_id", flat=True
        )

        release_envs = ReleaseEnvironment.objects.filter(
            release_id__in=release_projects,
            organization_id=group.project.organization_id,
        )
        if environments:
            release_envs = release_envs.filter(environment_id__in=[env.id for env in environments])
        release_envs = release_envs.order_by("-first_seen").values_list("release_id", flat=True)

        group_releases = GroupRelease.objects.filter(
            group_id=group.id,
            release_id=release_envs[:1],
        )
        if environments:
            group_releases = group_releases.filter(
                environment__in=[env.name for env in environments],
            )
        try:
            return group_releases[0]
        except IndexError:
            return None

    def get(self, request, group):
        """Get the current release in the group's project.

        Find the most recent release in the project associated with the issue
        being viewed, regardless of whether the issue has been reported in that
        release. (That is, the latest release in which the user might expect to
        have seen the issue.) Then, if the issue has indeed been seen in that
        release, provide a reference to it. If not, indicate so with a null
        value for "current release".

        If the user is filtering by environment, include only releases in those
        environments. If `environments` is empty, include all environments
        because the user is not filtering.
        """

        environments = get_environments(request, group.project.organization)

        with sentry_sdk.start_span(op="CurrentReleaseEndpoint.get.current_release") as span:
            span.set_data("Environment Count", len(environments))
            span.set_data(
                "Raw Parameters",
                {
                    "group.id": group.id,
                    "group.project_id": group.project_id,
                    "group.project.organization_id": group.project.organization_id,
                    "environments": [{"id": e.id, "name": e.name} for e in environments],
                },
            )
            current_release = self._get_current_release(group, environments)

        data = {
            "currentRelease": serialize(
                current_release, request.user, GroupReleaseWithStatsSerializer()
            )
        }
        return Response(data)
