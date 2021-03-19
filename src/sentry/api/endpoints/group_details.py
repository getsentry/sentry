from datetime import timedelta
import functools
import logging

from django.utils import timezone
from rest_framework.response import Response

from sentry import tsdb, tagstore, features
from sentry.api import client
from sentry.api.base import EnvironmentMixin
from sentry.api.bases import GroupEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import serialize, GroupSerializer, GroupSerializerSnuba
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.models import (
    Activity,
    Group,
    GroupSeen,
    Release,
    User,
    UserReport,
)
from sentry.api.helpers.group_index import prep_search, rate_limit_endpoint, update_groups
from sentry.plugins.base import plugins
from sentry.plugins.bases import IssueTrackingPlugin2
from sentry.signals import issue_deleted
from sentry.utils import metrics
from sentry.utils.safe import safe_execute
from sentry.utils.compat import zip
from sentry.models.groupinbox import get_inbox_details

delete_logger = logging.getLogger("sentry.deletions.api")


class GroupDetailsEndpoint(GroupEndpoint, EnvironmentMixin):
    def _get_activity(self, request, group, num):
        activity_items = set()
        activity = []
        activity_qs = (
            Activity.objects.filter(group=group).order_by("-datetime").select_related("user")
        )
        # we select excess so we can filter dupes
        for item in activity_qs[: num * 2]:
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
            GroupSeen.objects.filter(group=group).select_related("user").order_by("-last_seen")
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
                plugin
                for plugin in plugins.for_project(project, version=None)
                if plugin.has_project_conf()
                and hasattr(plugin, "get_custom_contexts")
                and plugin.get_custom_contexts()
            ],
            request.user,
            PluginSerializer(project),
        )

    def _get_release_info(self, request, group, version):
        try:
            release = Release.objects.get(
                projects=group.project,
                organization_id=group.project.organization_id,
                version=version,
            )
        except Release.DoesNotExist:
            release = {"version": version}
        return serialize(release, request.user)

    def _get_first_last_release_info(self, request, group, versions):
        releases = {
            release.version: release
            for release in Release.objects.filter(
                projects=group.project,
                organization_id=group.project.organization_id,
                version__in=versions,
            )
        }
        serialized_releases = serialize(
            [releases.get(version) for version in versions],
            request.user,
        )
        # Default to a dictionary if the release object wasn't found and not serialized
        return [
            item if item is not None else {"version": version}
            for item, version in zip(serialized_releases, versions)
        ]

    @rate_limit_endpoint(limit=5, window=1)
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
        try:
            # TODO(dcramer): handle unauthenticated/public response
            from sentry.utils import snuba

            organization = group.project.organization
            environments = get_environments(request, organization)
            environment_ids = [e.id for e in environments]
            expand = request.GET.getlist("expand", [])
            has_inbox = features.has("organizations:inbox", organization, actor=request.user)

            # WARNING: the rest of this endpoint relies on this serializer
            # populating the cache SO don't move this :)
            data = serialize(
                group, request.user, GroupSerializerSnuba(environment_ids=environment_ids)
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

            if first_release is not None and last_release is not None:
                first_release, last_release = self._get_first_last_release_info(
                    request, group, [first_release, last_release]
                )
            elif first_release is not None:
                first_release = self._get_release_info(request, group, first_release)
            elif last_release is not None:
                last_release = self._get_release_info(request, group, last_release)

            get_range = functools.partial(tsdb.get_range, environment_ids=environment_ids)

            tags = tagstore.get_group_tag_keys(
                group.project_id, group.id, environment_ids, limit=100
            )
            if not environment_ids:
                user_reports = UserReport.objects.filter(group_id=group.id)
            else:
                user_reports = UserReport.objects.filter(
                    group_id=group.id, environment_id__in=environment_ids
                )

            now = timezone.now()
            hourly_stats = tsdb.rollup(
                get_range(
                    model=tsdb.models.group, keys=[group.id], end=now, start=now - timedelta(days=1)
                ),
                3600,
            )[group.id]
            daily_stats = tsdb.rollup(
                get_range(
                    model=tsdb.models.group,
                    keys=[group.id],
                    end=now,
                    start=now - timedelta(days=30),
                ),
                3600 * 24,
            )[group.id]

            participants = list(
                User.objects.filter(
                    groupsubscription__is_active=True, groupsubscription__group=group
                )
            )

            if "inbox" in expand and has_inbox:
                inbox_map = get_inbox_details([group])
                inbox_reason = inbox_map.get(group.id)
                data.update({"inbox": inbox_reason})

            data.update(
                {
                    "firstRelease": first_release,
                    "lastRelease": last_release,
                    "activity": serialize(activity, request.user),
                    "seenBy": seen_by,
                    "participants": serialize(participants, request.user),
                    "pluginActions": action_list,
                    "pluginIssues": self._get_available_issue_plugins(request, group),
                    "pluginContexts": self._get_context_plugins(request, group),
                    "userReportCount": user_reports.count(),
                    "tags": sorted(serialize(tags, request.user), key=lambda x: x["name"]),
                    "stats": {"24h": hourly_stats, "30d": daily_stats},
                }
            )

            metrics.incr(
                "group.update.http_response",
                sample_rate=1.0,
                tags={"status": 200, "detail": "group_details:get:response"},
            )
            return Response(data)
        except snuba.RateLimitExceeded:
            metrics.incr(
                "group.update.http_response",
                sample_rate=1.0,
                tags={"status": 429, "detail": "group_details:get:snuba.RateLimitExceeded"},
            )
            raise
        except Exception:
            metrics.incr(
                "group.update.http_response",
                sample_rate=1.0,
                tags={"status": 500, "detail": "group_details:get:Exception"},
            )
            raise

    @rate_limit_endpoint(limit=5, window=1)
    def put(self, request, group):
        """
        Update an Issue
        ```````````````

        Updates an individual issue's attributes. Only the attributes submitted
        are modified.

        :pparam string issue_id: the ID of the group to retrieve.
        :param string status: the new status for the issue.  Valid values
                              are ``"resolved"``, ``resolvedInNextRelease``,
                              ``"unresolved"``, and ``"ignored"``.
        :param string assignedTo: the user or team that should be assigned to
                                  this issue. Can be of the form ``"<user_id>"``,
                                  ``"user:<user_id>"``, ``"<username>"``,
                                  ``"<user_primary_email>"``, or ``"team:<team_id>"``.
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
        try:
            discard = request.data.get("discard")
            project = group.project
            search_fn = functools.partial(prep_search, self, request, project)
            has_inbox = features.has(
                "organizations:inbox", project.organization, actor=request.user
            )
            response = update_groups(
                request, [group.id], [project], project.organization_id, search_fn, has_inbox
            )

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
                        request, group.project.organization_id
                    )
                ),
            )
            return Response(serialized, status=response.status_code)
        except client.ApiError as e:
            logging.error(
                "group_details:put client.ApiError",
                exc_info=True,
            )
            return Response(e.body, status=e.status_code)
        except Exception:
            raise

    @rate_limit_endpoint(limit=5, window=1)
    def delete(self, request, group):
        """
        Remove an Issue
        ```````````````

        Removes an individual issue.

        :pparam string issue_id: the ID of the issue to delete.
        :auth: required
        """
        try:
            from sentry.utils import snuba
            from sentry.group_deletion import delete_group

            transaction_id = delete_group(group)

            if transaction_id:
                self.create_audit_entry(
                    request=request,
                    organization_id=group.project.organization_id if group.project else None,
                    target_object=group.id,
                    transaction_id=transaction_id,
                )

                delete_logger.info(
                    "object.delete.queued",
                    extra={
                        "object_id": group.id,
                        "transaction_id": transaction_id,
                        "model": type(group).__name__,
                    },
                )

                # This is exclusively used for analytics, as such it should not run as part of reprocessing.
                issue_deleted.send_robust(
                    group=group, user=request.user, delete_type="delete", sender=self.__class__
                )

            metrics.incr(
                "group.update.http_response",
                sample_rate=1.0,
                tags={"status": 200, "detail": "group_details:delete:Reponse"},
            )
            return Response(status=202)
        except snuba.RateLimitExceeded:
            metrics.incr(
                "group.update.http_response",
                sample_rate=1.0,
                tags={"status": 429, "detail": "group_details:delete:snuba.RateLimitExceeded"},
            )
            raise
        except Exception:
            metrics.incr(
                "group.update.http_response",
                sample_rate=1.0,
                tags={"status": 500, "detail": "group_details:delete:Exception"},
            )
            raise
