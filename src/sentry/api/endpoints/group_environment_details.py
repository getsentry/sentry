from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import StatsMixin
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.grouprelease import (
    GroupReleaseWithStatsSerializer
)
from sentry.models import GroupRelease


class GroupEnvironmentDetailsEndpoint(GroupEndpoint, StatsMixin):
    def get(self, request, group, environment):
        # XXX(dcramer): we have no great way to pass the empty env
        if environment == 'none':
            environment = ''

        try:
            first_release = GroupRelease.objects.filter(
                group_id=group.id,
                environment=environment,
            ).order_by('first_seen')[0]
        except IndexError:
            first_release = None

        try:
            last_release = GroupRelease.objects.filter(
                group_id=group.id,
                environment=environment,
            ).order_by('-first_seen')[0]
        except IndexError:
            last_release = None

        stats_args = self._parse_args(request)

        context = {
            'environment': {
                'name': environment,
            },
            'firstRelease': serialize(first_release, request.user),
            'lastRelease': serialize(
                last_release, request.user, GroupReleaseWithStatsSerializer(
                    since=stats_args['start'],
                    until=stats_args['end'],
                )
            ),
        }
        return Response(context)
