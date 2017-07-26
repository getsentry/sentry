from __future__ import absolute_import

from django.db.models import Q
from operator import or_
from rest_framework.response import Response
from six.moves import reduce

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import TagBasedStreamGroupSerializer
from sentry.models import (EventUser, Group, GroupTagValue)


class OrganizationUserIssuesEndpoint(OrganizationEndpoint):
    def get(self, request, organization, user_id):
        limit = request.GET.get('limit', 100)

        euser = EventUser.objects.select_related('project__team').get(
            project__organization=organization,
            id=user_id,
        )
        # they have organization access but not to this project, thus
        # they shouldn't be able to see this user
        if not request.access.has_team_access(euser.project.team):
            return Response([])

        other_eusers = euser.find_similar_users(request.user)
        event_users = [euser] + list(other_eusers)

        if event_users:
            tag_filters = [Q(value=eu.tag_value, project_id=eu.project_id) for eu in event_users]
            tags = GroupTagValue.objects.filter(
                reduce(or_, tag_filters),
                key='sentry:user',
            ).order_by('-last_seen')[:limit]
        else:
            tags = GroupTagValue.objects.none()

        tags = {t.group_id: t for t in tags}
        if tags:
            groups = sorted(
                Group.objects.filter(
                    id__in=tags.keys(),
                ).order_by('-last_seen')[:limit],
                key=lambda x: tags[x.id].last_seen,
                reverse=True,
            )
        else:
            groups = []

        context = serialize(
            groups, request.user, TagBasedStreamGroupSerializer(
                stats_period=None,
                tags=tags,
            )
        )

        return Response(context)
