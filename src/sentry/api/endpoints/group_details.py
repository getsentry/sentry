from __future__ import absolute_import, print_function

from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import DocSection, Endpoint
from sentry.api.fields import UserField
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.constants import STATUS_CHOICES
from sentry.db.models.query import create_or_update
from sentry.models import (
    Activity, Group, GroupAssignee, GroupBookmark, GroupSeen, GroupStatus
)


class GroupSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=zip(
        STATUS_CHOICES.keys(), STATUS_CHOICES.keys()
    ))
    isBookmarked = serializers.BooleanField()
    assignedTo = UserField()


class GroupDetailsEndpoint(Endpoint):
    doc_section = DocSection.EVENTS

    def _get_activity(self, request, group, num=7):
        activity_items = set()
        activity = []
        activity_qs = Activity.objects.filter(
            group=group,
        ).order_by('-datetime').select_related('user')
        # we select excess so we can filter dupes
        for item in activity_qs[:num * 2]:
            sig = (item.event_id, item.type, item.ident, item.user_id)
            # TODO: we could just generate a signature (hash(text)) for notes
            # so there's no special casing
            if item.type == Activity.NOTE:
                activity.append(item)
            elif sig not in activity_items:
                activity_items.add(sig)
                activity.append(item)

        activity.append(Activity(
            project=group.project,
            group=group,
            type=Activity.FIRST_SEEN,
            datetime=group.first_seen,
        ))

        return activity[:num]

    def _get_seen_by(self, request, group):
        seen_by = sorted([
            (gs.user, gs.last_seen)
            for gs in GroupSeen.objects.filter(
                group=group
            ).select_related('user')
        ], key=lambda ls: ls[1], reverse=True)
        return [s[0] for s in seen_by]

    def get(self, request, group_id):
        """
        Retrieve an aggregate

        Return details on an individual aggregate.

            {method} {path}

        """
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        data = serialize(group, request.user)

        # TODO: these probably should be another endpoint
        activity = self._get_activity(request, group, num=7)
        seen_by = self._get_seen_by(request, group)

        data.update({
            'activity': serialize(activity, request.user),
            'seenBy': serialize(seen_by, request.user),
        })

        return Response(data)

    def put(self, request, group_id):
        """
        Update an aggregate

        Updates an individual aggregate's attributes.

            {method} {path}
            {{
              "status": "resolved"
            }}

        Attributes:

        - status: resolved, unresolved, muted
        - isBookmarked: true, false
        - assignedTo: user

        """

        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        serializer = GroupSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        if result.get('assignedTo') and not group.project.has_access(result['assignedTo']):
            return Response(status=400)

        if result.get('status') == 'resolved':
            now = timezone.now()

            group.resolved_at = now
            group.status = GroupStatus.RESOLVED

            happened = Group.objects.filter(
                id=group.id,
            ).exclude(status=GroupStatus.RESOLVED).update(
                status=GroupStatus.RESOLVED,
                resolved_at=now,
            )

            if happened:
                create_or_update(
                    Activity,
                    project=group.project,
                    group=group,
                    type=Activity.SET_RESOLVED,
                    user=request.user,
                )
        elif result.get('status'):
            group.status = STATUS_CHOICES[result['status']]
            group.save()

        if result.get('isBookmarked'):
            GroupBookmark.objects.get_or_create(
                project=group.project,
                group=group,
                user=request.user,
            )
        elif result.get('isBookmarked') is False:
            GroupBookmark.objects.filter(
                group=group,
                user=request.user,
            ).delete()

        if 'assignedTo' in result:
            now = timezone.now()

            if result['assignedTo']:
                assignee, created = GroupAssignee.objects.get_or_create(
                    group=group,
                    defaults={
                        'project': group.project,
                        'user': result['assignedTo'],
                        'date_added': now,
                    }
                )

                if not created:
                    affected = GroupAssignee.objects.filter(
                        group=group,
                    ).exclude(
                        user=result['assignedTo'],
                    ).update(
                        user=result['assignedTo'],
                        date_added=now
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
                        data={
                            'assignee': result['assignedTo'].id,
                        }
                    )

                    if request.user != assignee.user:
                        # TODO(dcramer): send email
                        pass

            else:
                affected = GroupAssignee.objects.filter(
                    group=group,
                ).delete()

                if affected:
                    create_or_update(
                        Activity,
                        project=group.project,
                        group=group,
                        type=Activity.UNASSIGNED,
                        user=request.user,
                    )

        return Response(serialize(group, request.user))

    def delete(self, request, group_id):
        """
        Delete an aggregate

        Deletes an individual aggregate.

            {method} {path}
        """
        from sentry.tasks.deletion import delete_group

        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        delete_group.delay(object_id=group.id)

        return Response(status=202)
