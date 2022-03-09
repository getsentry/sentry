import functools
import logging
from datetime import timedelta

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore, tsdb
from sentry.api import client
from sentry.api.base import EnvironmentMixin
from sentry.api.bases import GroupEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.helpers.group_index import (
    delete_group_list,
    get_first_last_release,
    prep_search,
    update_groups,
)
from sentry.api.serializers import GroupSerializer, GroupSerializerSnuba, serialize
from sentry.api.serializers.models.plugin import PluginSerializer, is_plugin_deprecated
from sentry.models import Activity, Group, GroupSeen, GroupSubscriptionManager, UserReport
from sentry.models.groupinbox import get_inbox_details
from sentry.plugins.base import plugins
from sentry.plugins.bases import IssueTrackingPlugin2
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import metrics
from sentry.utils.safe import safe_execute

delete_logger = logging.getLogger("sentry.deletions.api")


class GroupDetailsEndpoint(GroupEndpoint, EnvironmentMixin):
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(5, 1),
            RateLimitCategory.USER: RateLimit(5, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(5, 1),
        },
        "PUT": {
            RateLimitCategory.IP: RateLimit(5, 1),
            RateLimitCategory.USER: RateLimit(5, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(5, 1),
        },
        "DELETE": {
            RateLimitCategory.IP: RateLimit(5, 5),
            RateLimitCategory.USER: RateLimit(5, 5),
            RateLimitCategory.ORGANIZATION: RateLimit(5, 5),
        },
    }

    def _get_activity(self, request: Request, group, num):
        return Activity.objects.get_activities_for_group(group, num)

    def _get_seen_by(self, request: Request, group):
        seen_by = list(
            GroupSeen.objects.filter(group=group).select_related("user").order_by("-last_seen")
        )
        return serialize(seen_by, request.user)

    def _get_actions(self, request: Request, group):
        project = group.project

        action_list = []
        for plugin in plugins.for_project(project, version=1):
            if is_plugin_deprecated(plugin, project):
                continue

            results = safe_execute(
                plugin.actions, request, group, action_list, _with_transaction=False
            )

            if not results:
                continue

            action_list = results

        for plugin in plugins.for_project(project, version=2):
            if is_plugin_deprecated(plugin, project):
                continue
            for action in (
                safe_execute(plugin.get_actions, request, group, _with_transaction=False) or ()
            ):
                action_list.append(action)

        return action_list

    def _get_available_issue_plugins(self, request: Request, group):
        project = group.project

        plugin_issues = []
        for plugin in plugins.for_project(project, version=1):
            if isinstance(plugin, IssueTrackingPlugin2):
                if is_plugin_deprecated(plugin, project):
                    continue
                plugin_issues = safe_execute(
                    plugin.plugin_issues, request, group, plugin_issues, _with_transaction=False
                )
        return plugin_issues

    def _get_context_plugins(self, request: Request, group):
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

    def get(self, request: Request, group) -> Response:
        """
        Retrieve an Issue
        `````````````````

        Return details on an individual issue. This returns the basic stats for
        the issue (title, last seen, first seen), some overall numbers (number
        of comments, user reports) as well as the summarized event data.

        :pparam string issue_id: the ID of the issue to retrieve.
        :auth: required
        """
        from sentry.utils import snuba

        try:
            # TODO(dcramer): handle unauthenticated/public response

            organization = group.project.organization
            environments = get_environments(request, organization)
            environment_ids = [e.id for e in environments]
            expand = request.GET.getlist("expand", [])
            collapse = request.GET.getlist("collapse", [])

            # WARNING: the rest of this endpoint relies on this serializer
            # populating the cache SO don't move this :)
            data = serialize(
                group, request.user, GroupSerializerSnuba(environment_ids=environment_ids)
            )

            # TODO: these probably should be another endpoint
            activity = self._get_activity(request, group, num=100)
            seen_by = self._get_seen_by(request, group)

            if "release" not in collapse:
                first_release, last_release = get_first_last_release(request, group)
                data.update(
                    {
                        "firstRelease": first_release,
                        "lastRelease": last_release,
                    }
                )

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

            participants = GroupSubscriptionManager.get_participating_users(group)

            if "inbox" in expand:
                inbox_map = get_inbox_details([group])
                inbox_reason = inbox_map.get(group.id)
                data.update({"inbox": inbox_reason})

            action_list = self._get_actions(request, group)
            data.update(
                {
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

    def put(self, request: Request, group) -> Response:
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
        :param string assignedBy: ``"suggested_assignee"`` | ``"assignee_selector"``
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
            response = update_groups(
                request, [group.id], [project], project.organization_id, search_fn
            )
            # if action was discard, there isn't a group to serialize anymore
            # if response isn't 200, return the response update_groups gave us (i.e. helpful error)
            # instead of serializing the updated group
            if discard or response.status_code != 200:
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

    def delete(self, request: Request, group) -> Response:
        """
        Remove an Issue
        ```````````````

        Removes an individual issue.

        :pparam string issue_id: the ID of the issue to delete.
        :auth: required
        """
        from sentry.utils import snuba

        try:
            delete_group_list(request, group.project, [group], "delete")

            metrics.incr(
                "group.update.http_response",
                sample_rate=1.0,
                tags={"status": 200, "detail": "group_details:delete:Response"},
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
