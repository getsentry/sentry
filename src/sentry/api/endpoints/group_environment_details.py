from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.environment import (
    GroupEnvironmentWithStatsSerializer
)
from sentry.api.serializers.models.grouprelease import (
    GroupReleaseWithStatsSerializer
)
from sentry.models import Environment, GroupRelease, ReleaseEnvironment
from sentry.utils.dates import to_datetime


class GroupEnvironmentDetailsEndpoint(GroupEndpoint):
    def get(self, request, group, environment):
        try:
            environment = Environment.objects.get(
                project_id=group.project_id,
                # XXX(dcramer): we have no great way to pass the empty env
                name='' if environment == 'none' else environment,
            )
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist

        first_release = GroupRelease.objects.filter(
            group_id=group.id,
            environment=environment.name,
        ).order_by('first_seen').first()

        last_release = GroupRelease.objects.filter(
            group_id=group.id,
            environment=environment.name,
        ).order_by('-first_seen').first()

        # the current release is the 'latest seen' release within the
        # environment even if it hasnt affected this issue
        current_release = GroupRelease.objects.filter(
            group_id=group.id,
            environment=environment.name,
            release_id=ReleaseEnvironment.objects.filter(
                project_id=group.project_id,
                environment_id=environment.id,
            ).order_by('-first_seen').values_list('release_id', flat=True).first(),
        ).first()

        last_seen = GroupRelease.objects.filter(
            group_id=group.id,
            environment=environment.name,
        ).order_by('-last_seen').values_list('last_seen', flat=True).first()

        until = request.GET.get('until')
        if until:
            until = to_datetime(float(until))

        context = {
            'environment': serialize(
                environment, request.user, GroupEnvironmentWithStatsSerializer(
                    group=group,
                    until=until,
                )
            ),
            'firstRelease': serialize(first_release, request.user),
            'lastRelease': serialize(last_release, request.user),
            'currentRelease': serialize(
                current_release, request.user, GroupReleaseWithStatsSerializer(
                    until=until,
                )
            ),
            'lastSeen': last_seen,
            'firstSeen': first_release.first_seen if first_release else None,
        }
        return Response(context)
