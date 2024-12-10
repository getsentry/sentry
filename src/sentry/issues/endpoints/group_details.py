import functools
import logging
from collections.abc import Sequence
from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, tagstore, tsdb
from sentry.api import client
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.helpers.group_index import (
    delete_group_list,
    get_first_last_release,
    prep_search,
    update_groups_with_search_fn,
)
from sentry.api.serializers import GroupSerializer, GroupSerializerSnuba, serialize
from sentry.api.serializers.models.group_stream import get_actions, get_available_issue_plugins
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.api.serializers.models.team import TeamSerializer
from sentry.integrations.api.serializers.models.external_issue import ExternalIssueSerializer
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.issues.constants import get_issue_tsdb_group_model
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.grouptype import GroupCategory
from sentry.models.activity import Activity
from sentry.models.eventattachment import EventAttachment
from sentry.models.group import Group
from sentry.models.groupinbox import get_inbox_details
from sentry.models.grouplink import GroupLink
from sentry.models.groupowner import get_owner_details
from sentry.models.groupseen import GroupSeen
from sentry.models.groupsubscription import GroupSubscriptionManager
from sentry.models.team import Team
from sentry.models.userreport import UserReport
from sentry.plugins.base import plugins
from sentry.sentry_apps.api.serializers.platform_external_issue import (
    PlatformExternalIssueSerializer,
)
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.tasks.post_process import fetch_buffered_group_stats
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

delete_logger = logging.getLogger("sentry.deletions.api")


def get_group_global_count(group: Group) -> str:
    fetch_buffered_group_stats(group)
    return str(group.times_seen_with_pending)


@region_silo_endpoint
class GroupDetailsEndpoint(GroupEndpoint, EnvironmentMixin):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=5, window=1),
            RateLimitCategory.USER: RateLimit(limit=5, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=1),
        },
        "PUT": {
            RateLimitCategory.IP: RateLimit(limit=5, window=1),
            RateLimitCategory.USER: RateLimit(limit=5, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=1),
        },
        "DELETE": {
            RateLimitCategory.IP: RateLimit(limit=5, window=5),
            RateLimitCategory.USER: RateLimit(limit=5, window=5),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=5),
        },
    }

    def _get_activity(self, request: Request, group, num):
        return Activity.objects.get_activities_for_group(group, num)

    def _get_seen_by(self, request: Request, group):
        seen_by = list(GroupSeen.objects.filter(group=group).order_by("-last_seen"))
        return [seen for seen in serialize(seen_by, request.user) if seen is not None]

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

    @staticmethod
    def __group_hourly_daily_stats(group: Group, environment_ids: Sequence[int]):
        model = get_issue_tsdb_group_model(group.issue_category)
        now = timezone.now()
        hourly_stats = tsdb.backend.rollup(
            tsdb.backend.get_range(
                model=model,
                keys=[group.id],
                end=now,
                start=now - timedelta(days=1),
                environment_ids=environment_ids,
                tenant_ids={"organization_id": group.project.organization_id},
            ),
            3600,
        )[group.id]
        daily_stats = tsdb.backend.rollup(
            tsdb.backend.get_range(
                model=model,
                keys=[group.id],
                end=now,
                start=now - timedelta(days=30),
                environment_ids=environment_ids,
                tenant_ids={"organization_id": group.project.organization_id},
            ),
            3600 * 24,
        )[group.id]

        return hourly_stats, daily_stats

    def get(self, request: Request, group) -> Response:
        """
        Retrieve an Issue
        `````````````````

        Return details on an individual issue. This returns the basic stats for
        the issue (title, last seen, first seen), some overall numbers (number
        of comments, user reports) as well as the summarized event data.

        :pparam string organization_id_or_slug: the id or slug of the organization.
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

            if "tags" not in collapse:
                tags = tagstore.backend.get_group_tag_keys(
                    group,
                    environment_ids,
                    limit=100,
                    tenant_ids={"organization_id": group.project.organization_id},
                )
                data.update(
                    {
                        "tags": sorted(serialize(tags, request.user), key=lambda x: x["name"]),
                    }
                )

            user_reports = (
                UserReport.objects.filter(group_id=group.id)
                if not environment_ids
                else UserReport.objects.filter(
                    group_id=group.id, environment_id__in=environment_ids
                )
            )

            hourly_stats, daily_stats = self.__group_hourly_daily_stats(group, environment_ids)

            if "inbox" in expand:
                inbox_map = get_inbox_details([group])
                inbox_reason = inbox_map.get(group.id)
                data.update({"inbox": inbox_reason})

            if "owners" in expand:
                owner_details = get_owner_details([group], request.user)
                owners = owner_details.get(group.id)
                data.update({"owners": owners})

            if "forecast" in expand:
                fetched_forecast = EscalatingGroupForecast.fetch(group.project_id, group.id)
                if fetched_forecast:
                    fetched_forecast_dict = fetched_forecast.to_dict()
                    data.update(
                        {
                            "forecast": {
                                "data": fetched_forecast_dict.get("forecast"),
                                "date_added": fetched_forecast_dict.get("date_added"),
                            }
                        }
                    )

            if "integrationIssues" in expand:
                external_issues = ExternalIssue.objects.filter(
                    id__in=GroupLink.objects.filter(group_id__in=[group.id]).values_list(
                        "linked_id", flat=True
                    ),
                )
                integration_issues = serialize(
                    external_issues,
                    request,
                    serializer=ExternalIssueSerializer(),
                )
                data.update({"integrationIssues": integration_issues})

            if "sentryAppIssues" in expand:
                platform_external_issues = PlatformExternalIssue.objects.filter(group_id=group.id)
                sentry_app_issues = serialize(
                    list(platform_external_issues),
                    request,
                    serializer=PlatformExternalIssueSerializer(),
                )
                data.update({"sentryAppIssues": sentry_app_issues})

            if "latestEventHasAttachments" in expand:
                if not features.has(
                    "organizations:event-attachments",
                    group.project.organization,
                    actor=request.user,
                ):
                    return self.respond(status=404)

                latest_event = group.get_latest_event()
                if latest_event is not None:
                    num_attachments = EventAttachment.objects.filter(
                        project_id=latest_event.project_id, event_id=latest_event.event_id
                    ).count()
                    data.update({"latestEventHasAttachments": num_attachments > 0})

            data.update(
                {
                    "activity": serialize(activity, request.user),
                    "seenBy": seen_by,
                    "pluginActions": get_actions(request, group),
                    "pluginIssues": get_available_issue_plugins(request, group),
                    "pluginContexts": self._get_context_plugins(request, group),
                    "userReportCount": user_reports.count(),
                    "stats": {"24h": hourly_stats, "30d": daily_stats},
                    "count": get_group_global_count(group),
                }
            )

            participants = user_service.serialize_many(
                filter={"user_ids": GroupSubscriptionManager.get_participating_user_ids(group)},
                as_user=request.user,
            )

            for participant in participants:
                participant["type"] = "user"

            if features.has("organizations:team-workflow-notifications", group.organization):
                team_ids = GroupSubscriptionManager.get_participating_team_ids(group)

                teams = Team.objects.filter(id__in=team_ids)
                team_serializer = TeamSerializer()

                serialized_teams = []
                for team in teams:
                    serialized_team = serialize(team, request.user, team_serializer)
                    serialized_team["type"] = "team"
                    serialized_teams.append(serialized_team)

                participants.extend(serialized_teams)

            data.update({"participants": participants})

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
        :param string substatus: the new substatus for the issues. Valid values
                                 defined in GroupSubStatus.
        :auth: required
        """
        try:
            discard = request.data.get("discard")
            project = group.project
            search_fn = functools.partial(prep_search, self, request, project)
            response = update_groups_with_search_fn(
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
            logging.exception(
                "group_details:put client.ApiError",
            )
            return Response(e.body, status=e.status_code)

    def delete(self, request: Request, group: Group) -> Response:
        """
        Remove an Issue
        ```````````````

        Removes an individual issue.

        :pparam string issue_id: the ID of the issue to delete.
        :auth: required
        """
        from sentry.utils import snuba

        issue_platform_deletion_allowed = features.has(
            "organizations:issue-platform-deletion", group.project.organization, actor=request.user
        )

        if group.issue_category != GroupCategory.ERROR and not issue_platform_deletion_allowed:
            raise ValidationError(detail="Only error issues can be deleted.")

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
