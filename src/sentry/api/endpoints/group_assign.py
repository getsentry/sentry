from __future__ import absolute_import

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.db.models import create_or_update
from sentry.models import Group, GroupAssignee, Activity


class GroupAssigneeSerializer(serializers.ModelSerializer):
    user = serializers.SlugRelatedField(slug_field='username')

    class Meta:
        model = GroupAssignee
        fields = ('user',)


class GroupAssignEndpoint(Endpoint):
    def post(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        serializer = GroupAssigneeSerializer(data=request.DATA)

        if serializer.is_valid():
            user = serializer.object.user
            now = timezone.now()

            assignee, created = GroupAssignee.objects.get_or_create(
                group=group,
                defaults={
                    'project': group.project,
                    'user': user,
                    'date_added': now,
                }
            )

            if not created:
                affected = GroupAssignee.objects.filter(
                    group=group,
                ).exclude(user=user).update(
                    user=user, date_added=now
                )
            else:
                affected = True

            if affected:
                create_or_update(
                    Activity,
                    project=group.project,
                    group=group,
                    type=Activity.ASSIGNED,
                    user=request.user,
                )

            return Response()

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
