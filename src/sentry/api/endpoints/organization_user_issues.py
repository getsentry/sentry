from __future__ import absolute_import

from rest_framework.response import Response

from sentry import tagstore
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import TagBasedStreamGroupSerializer
from sentry.models import (EventUser, Group, Project)


class OrganizationUserIssuesEndpoint(OrganizationEndpoint):
    def get(self, request, organization, user_id):
        limit = request.GET.get('limit', 100)

        project_ids = organization.project_set.values_list('id', flat=True)
        euser = EventUser.objects.get(
            project_id__in=project_ids,
            id=user_id,
        )
        # they have organization access but not to this project, thus
        # they shouldn't be able to see this user
        if not request.access.has_team_access(
                Project.objects.select_related('team').get(pk=euser.project_id).team):
            return Response([])

        other_eusers = euser.find_similar_users(request.user)
        event_users = [euser] + list(other_eusers)

        if event_users:
            tags = tagstore.get_group_tag_values_for_users(event_users, limit=limit)
        else:
            tags = []

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
