from __future__ import absolute_import, print_function

from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.api.fields import UserField
from sentry.api.serializers import serialize
from sentry.db.models.query import create_or_update
from sentry.constants import STATUS_CHOICES
from sentry.models import (
    Activity, Group, GroupAssignee, GroupBookmark, GroupSeen, GroupStatus,
    GroupTagValue, Release, UserReport
)
from sentry.plugins import plugins
from sentry.utils.safe import safe_execute


class GroupSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=zip(
        STATUS_CHOICES.keys(), STATUS_CHOICES.keys()
    ))
    isBookmarked = serializers.BooleanField()
    hasSeen = serializers.BooleanField()
    assignedTo = UserField()


class GroupDetailsEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def _get_activity(self, request, group, num):
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
        seen_by = list(GroupSeen.objects.filter(
            group=group
        ).select_related('user').order_by('-last_seen'))
        return serialize(seen_by, request.user)

    def _get_actions(self, request, group):
        project = group.project

        action_list = []
        for plugin in plugins.for_project(project, version=1):
            results = safe_execute(plugin.actions, request, group, action_list)

            if not results:
                continue

            action_list = results

        for plugin in plugins.for_project(project, version=2):
            for action in (safe_execute(plugin.get_actions, request, group) or ()):
                action_list.append(action)

        return action_list

    def _get_release_info(self, request, group, version):
        try:
            release = Release.objects.get(
                project=group.project,
                version=version,
            )
        except Release.DoesNotExist:
            return {'version': version}
        return serialize(release, request.user)

    def get(self, request, group):
        """
        Retrieve an aggregate

        Return details on an individual aggregate.

            {method} {path}

        """
        # TODO(dcramer): handle unauthenticated/public response
        data = serialize(group, request.user)

        # TODO: these probably should be another endpoint
        activity = self._get_activity(request, group, num=100)
        seen_by = self._get_seen_by(request, group)

        # find first seen release
        if group.first_release is None:
            try:
                first_release = GroupTagValue.objects.filter(
                    group=group,
                    key__in=('sentry:release', 'release'),
                ).order_by('first_seen')[0]
            except IndexError:
                first_release = None
            else:
                first_release = first_release.value
        else:
            first_release = group.first_release.version

        if first_release is not None:
            # find last seen release
            try:
                last_release = GroupTagValue.objects.filter(
                    group=group,
                    key__in=('sentry:release', 'release'),
                ).order_by('-last_seen')[0]
            except IndexError:
                last_release = None
            else:
                last_release = last_release.value
        else:
            last_release = None

        action_list = self._get_actions(request, group)

        now = timezone.now()
        hourly_stats = tsdb.rollup(tsdb.get_range(
            model=tsdb.models.group,
            keys=[group.id],
            end=now,
            start=now - timedelta(days=1),
        ), 3600)[group.id]
        daily_stats = tsdb.rollup(tsdb.get_range(
            model=tsdb.models.group,
            keys=[group.id],
            end=now,
            start=now - timedelta(days=30),
        ), 3600 * 24)[group.id]

        if first_release:
            first_release = self._get_release_info(request, group, first_release)
        if last_release:
            last_release = self._get_release_info(request, group, last_release)

        data.update({
            'firstRelease': first_release,
            'lastRelease': last_release,
            'activity': serialize(activity, request.user),
            'seenBy': seen_by,
            'pluginActions': action_list,
            'userReportCount': UserReport.objects.filter(group=group).count(),
            'stats': {
                '24h': hourly_stats,
                '30d': daily_stats,
            }
        })

        return Response(data)

    def put(self, request, group):
        """
        Update an aggregate

        Updates an individual aggregate's attributes.

            {method} {path}
            {{
              "status": "resolved"
            }}

        Attributes:

        - status: resolved, unresolved, muted
        - hasSeen: true, false
        - isBookmarked: true, false
        - assignedTo: user

        """
        serializer = GroupSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        # TODO(dcramer): we should allow assignment to anyone who has membership
        # even if that membership is not SSO linked
        if result.get('assignedTo') and not group.project.member_set.filter(user=result['assignedTo']).exists():
            return Response({'detail': 'Cannot assign to non-team member'}, status=400)

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

        if result.get('hasSeen') and group.project.member_set.filter(user=request.user).exists():
            instance, created = create_or_update(
                GroupSeen,
                group=group,
                user=request.user,
                project=group.project,
                values={
                    'last_seen': timezone.now(),
                }
            )
        elif result.get('hasSeen') is False:
            GroupSeen.objects.filter(
                group=group,
                user=request.user,
            ).delete()

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
                    activity = Activity.objects.create(
                        project=group.project,
                        group=group,
                        type=Activity.ASSIGNED,
                        user=request.user,
                        data={
                            'assignee': result['assignedTo'].id,
                        }
                    )
                    activity.send_notification()

            else:
                affected = GroupAssignee.objects.filter(
                    group=group,
                )[:1].count()
                GroupAssignee.objects.filter(
                    group=group,
                ).delete()

                if affected > 0:
                    activity = Activity.objects.create(
                        project=group.project,
                        group=group,
                        type=Activity.UNASSIGNED,
                        user=request.user,
                    )
                    activity.send_notification()

        return Response(serialize(group, request.user))

    def delete(self, request, group):
        """
        Delete an aggregate

        Deletes an individual aggregate.

            {method} {path}
        """
        from sentry.tasks.deletion import delete_group

        updated = Group.objects.filter(
            id=group.id,
        ).exclude(
            status__in=[
                GroupStatus.PENDING_DELETION,
                GroupStatus.DELETION_IN_PROGRESS,
            ]
        ).update(status=GroupStatus.PENDING_DELETION)
        if updated:
            delete_group.delay(object_id=group.id)

        return Response(status=202)
