from __future__ import absolute_import

from datetime import timedelta
import functools
import logging
from uuid import uuid4

from django.utils import timezone
from rest_framework.response import Response

from sentry import eventstream, tsdb, tagstore
from sentry.api import client
from sentry.api.base import DocSection, EnvironmentMixin
from sentry.api.bases import GroupEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import serialize, GroupSerializer, GroupSerializerSnuba
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.api.serializers.models.grouprelease import GroupReleaseWithStatsSerializer
from sentry.models import (
    Activity,
    Group,
    GroupHash,
    GroupRelease,
    GroupSeen,
    GroupStatus,
    Release,
    ReleaseEnvironment,
    ReleaseProject,
    User,
    UserReport,
)
from sentry.plugins import IssueTrackingPlugin2, plugins
from sentry.signals import issue_deleted
from sentry.utils.safe import safe_execute
from sentry.utils.apidocs import scenario, attach_scenarios

delete_logger = logging.getLogger('sentry.deletions.api')


@scenario('RetrieveAggregate')
def retrieve_aggregate_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(
        method='GET',
        path='/issues/%s/' % group.id,
    )


@scenario('UpdateAggregate')
def update_aggregate_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(method='PUT', path='/issues/%s/' % group.id, data={'status': 'unresolved'})


@scenario('DeleteAggregate')
def delete_aggregate_scenario(runner):
    with runner.isolated_project('Boring Mushrooms') as project:
        group = Group.objects.filter(project=project).first()
        runner.request(
            method='DELETE',
            path='/issues/%s/' % group.id,
        )


STATUS_CHOICES = {
    'resolved': GroupStatus.RESOLVED,
    'unresolved': GroupStatus.UNRESOLVED,
    'ignored': GroupStatus.IGNORED,
    'resolvedInNextRelease': GroupStatus.UNRESOLVED,

    # TODO(dcramer): remove in 9.0
    'muted': GroupStatus.IGNORED,
}


class GroupDetailsEndpoint(GroupEndpoint, EnvironmentMixin):
    doc_section = DocSection.EVENTS

    def _get_activity(self, request, group, num):
        activity_items = set()
        activity = []
        activity_qs = Activity.objects.filter(
            group=group,
        ).order_by('-datetime').select_related('user')
        # we select excess so we can filter dupes
        for item in activity_qs[:num * 2]:
            sig = (item.type, item.ident, item.user_id)
            # TODO: we could just generate a signature (hash(text)) for notes
            # so there's no special casing
            if item.type == Activity.NOTE:
                activity.append(item)
            elif sig not in activity_items:
                activity_items.add(sig)
                activity.append(item)

        activity.append(
            Activity(
                id=0,
                project=group.project,
                group=group,
                type=Activity.FIRST_SEEN,
                datetime=group.first_seen,
            )
        )

        return activity[:num]

    def _get_seen_by(self, request, group):
        seen_by = list(
            GroupSeen.objects.filter(group=group).select_related('user').order_by('-last_seen')
        )
        return serialize(seen_by, request.user)

    def _get_actions(self, request, group):
        project = group.project

        action_list = []
        for plugin in plugins.for_project(project, version=1):
            results = safe_execute(
                plugin.actions, request, group, action_list, _with_transaction=False
            )

            if not results:
                continue

            action_list = results

        for plugin in plugins.for_project(project, version=2):
            for action in (
                safe_execute(plugin.get_actions, request, group, _with_transaction=False) or ()
            ):
                action_list.append(action)

        return action_list

    def _get_available_issue_plugins(self, request, group):
        project = group.project

        plugin_issues = []
        for plugin in plugins.for_project(project, version=1):
            if isinstance(plugin, IssueTrackingPlugin2):
                plugin_issues = safe_execute(
                    plugin.plugin_issues, request, group, plugin_issues, _with_transaction=False
                )
        return plugin_issues

    def _get_context_plugins(self, request, group):
        project = group.project
        return serialize(
            [
                plugin for plugin in plugins.for_project(project, version=None)
                if plugin.has_project_conf() and hasattr(plugin, 'get_custom_contexts') and
                plugin.get_custom_contexts()
            ], request.user, PluginSerializer(project)
        )

    def _get_release_info(self, request, group, version):
        try:
            release = Release.objects.get(
                projects=group.project,
                organization_id=group.project.organization_id,
                version=version,
            )
        except Release.DoesNotExist:
            return {'version': version}
        return serialize(release, request.user)

    @attach_scenarios([retrieve_aggregate_scenario])
    def get(self, request, group):
        """
        Retrieve an Issue
        `````````````````

        Return details on an individual issue. This returns the basic stats for
        the issue (title, last seen, first seen), some overall numbers (number
        of comments, user reports) as well as the summarized event data.

        :pparam string issue_id: the ID of the issue to retrieve.
        :auth: required
        """
        # TODO(dcramer): handle unauthenticated/public response
        environments = get_environments(request, group.project.organization)
        environment_ids = [e.id for e in environments]

        # WARNING: the rest of this endpoint relies on this serializer
        # populating the cache SO don't move this :)
        data = serialize(
            group,
            request.user,
            GroupSerializerSnuba(
                environment_ids=environment_ids,
            )
        )

        # TODO: these probably should be another endpoint
        activity = self._get_activity(request, group, num=100)
        seen_by = self._get_seen_by(request, group)

        first_release = group.get_first_release()

        if first_release is not None:
            last_release = group.get_last_release()
        else:
            last_release = None

        action_list = self._get_actions(request, group)

        if first_release:
            first_release = self._get_release_info(request, group, first_release)
        if last_release:
            last_release = self._get_release_info(request, group, last_release)

        get_range = functools.partial(tsdb.get_range,
                                      environment_ids=environment_ids)

        tags = tagstore.get_group_tag_keys(
            group.project_id, group.id, environment_ids, limit=100)
        if not environment_ids:
            user_reports = UserReport.objects.filter(group=group)
        else:
            user_reports = UserReport.objects.filter(
                group=group, environment_id__in=environment_ids
            )

        now = timezone.now()
        hourly_stats = tsdb.rollup(
            get_range(
                model=tsdb.models.group,
                keys=[group.id],
                end=now,
                start=now - timedelta(days=1),
            ), 3600
        )[group.id]
        daily_stats = tsdb.rollup(
            get_range(
                model=tsdb.models.group,
                keys=[group.id],
                end=now,
                start=now - timedelta(days=30),
            ), 3600 * 24
        )[group.id]

        participants = list(
            User.objects.filter(
                groupsubscription__is_active=True,
                groupsubscription__group=group,
            )
        )

        data.update(
            {
                'firstRelease': first_release,
                'lastRelease': last_release,
                'activity': serialize(activity, request.user),
                'seenBy': seen_by,
                'participants': serialize(participants, request.user),
                'pluginActions': action_list,
                'pluginIssues': self._get_available_issue_plugins(request, group),
                'pluginContexts': self._get_context_plugins(request, group),
                'userReportCount': user_reports.count(),
                'tags': sorted(serialize(tags, request.user), key=lambda x: x['name']),
                'stats': {
                    '24h': hourly_stats,
                    '30d': daily_stats,
                }
            }
        )

        # the current release is the 'latest seen' release within the
        # environment even if it hasnt affected this issue
        if environments:
            try:
                current_release = GroupRelease.objects.filter(
                    group_id=group.id,
                    environment__in=[env.name for env in environments],
                    release_id=ReleaseEnvironment.objects.filter(
                        release_id__in=ReleaseProject.objects.filter(project_id=group.project_id
                                                                     ).values_list('release_id', flat=True),
                        organization_id=group.project.organization_id,
                        environment_id__in=environment_ids,
                    ).order_by('-first_seen').values_list('release_id', flat=True)[:1],
                )[0]
            except IndexError:
                current_release = None

            data.update({
                'currentRelease': serialize(
                    current_release, request.user, GroupReleaseWithStatsSerializer()
                )
            })

        return Response(data)

    @attach_scenarios([update_aggregate_scenario])
    def put(self, request, group):
        """
        Update an Issue
        ```````````````

        Updates an individual issues's attributes.  Only the attributes
        submitted are modified.

        :pparam string issue_id: the ID of the group to retrieve.
        :param string status: the new status for the issue.  Valid values
                              are ``"resolved"``, ``resolvedInNextRelease``,
                              ``"unresolved"``, and ``"ignored"``.
        :param string assignedTo: the actor id (or username) of the user or team that should be
                                  assigned to this issue.
        :param boolean hasSeen: in case this API call is invoked with a user
                                context this allows changing of the flag
                                that indicates if the user has seen the
                                event.
        :param boolean isBookmarked: in case this API call is invoked with a
                                     user context this allows changing of
                                     the bookmark flag.
        :param boolean isSubscribed:
        :param boolean isPublic: sets the issue to public or private.
        :auth: required
        """
        discard = request.data.get('discard')

        # TODO(dcramer): we need to implement assignedTo in the bulk mutation
        # endpoint
        try:
            response = client.put(
                path=u'/projects/{}/{}/issues/'.format(
                    group.project.organization.slug,
                    group.project.slug,
                ),
                params={
                    'id': group.id,
                },
                data=request.data,
                request=request,
            )
        except client.ApiError as e:
            return Response(e.body, status=e.status_code)

        # if action was discard, there isn't a group to serialize anymore
        if discard:
            return response

        # we need to fetch the object against as the bulk mutation endpoint
        # only returns a delta, and object mutation returns a complete updated
        # entity.
        # TODO(dcramer): we should update the API and have this be an explicit
        # flag (or remove it entirely) so that delta's are the primary response
        # for mutation.
        group = Group.objects.get(id=group.id)

        serialized = serialize(
            group,
            request.user,
            GroupSerializer(
                environment_func=self._get_environment_func(
                    request, group.project.organization_id)
            )
        )

        return Response(serialized, status=response.status_code)

    @attach_scenarios([delete_aggregate_scenario])
    def delete(self, request, group):
        """
        Remove an Issue
        ```````````````

        Removes an individual issue.

        :pparam string issue_id: the ID of the issue to delete.
        :auth: required
        """
        from sentry.tasks.deletion import delete_groups

        updated = Group.objects.filter(
            id=group.id,
        ).exclude(status__in=[
            GroupStatus.PENDING_DELETION,
            GroupStatus.DELETION_IN_PROGRESS,
        ]).update(status=GroupStatus.PENDING_DELETION)
        if updated:
            project = group.project

            eventstream_state = eventstream.start_delete_groups(group.project_id, [group.id])
            transaction_id = uuid4().hex

            GroupHash.objects.filter(
                project_id=group.project_id,
                group__id=group.id,
            ).delete()

            delete_groups.apply_async(
                kwargs={
                    'object_ids': [group.id],
                    'transaction_id': transaction_id,
                    'eventstream_state': eventstream_state,
                },
                countdown=3600,
            )

            self.create_audit_entry(
                request=request,
                organization_id=project.organization_id if project else None,
                target_object=group.id,
                transaction_id=transaction_id,
            )

            delete_logger.info(
                'object.delete.queued',
                extra={
                    'object_id': group.id,
                    'transaction_id': transaction_id,
                    'model': type(group).__name__,
                }
            )

            issue_deleted.send_robust(
                group=group,
                user=request.user,
                delete_type='delete',
                sender=self.__class__)

        return Response(status=202)
