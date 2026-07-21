import functools
import logging
from collections.abc import Sequence
from datetime import timedelta
from typing import Any, cast

from django.core.cache import cache
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features, tagstore, tsdb
from sentry.analytics.events.issue_viewed import IssueViewedEvent
from sentry.api import client
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.helpers.environments import get_environment_func, get_environments
from sentry.api.helpers.group_index import (
    delete_group_list,
    get_first_last_release,
    prep_search,
    update_groups_with_search_fn,
)
from sentry.api.helpers.group_index.validators import GroupValidator
from sentry.api.serializers import GroupSerializer, GroupSerializerSnuba, serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse, GroupDetailsResponse
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.issue_examples import IssueExamples
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.integrations.api.serializers.models.external_issue import ExternalIssueSerializer
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.issues.action_log import (
    publish_action,
    resolve_action_actor,
    resolve_action_source,
)
from sentry.issues.action_log.types import ViewAction
from sentry.issues.constants import (
    ISSUE_VIEW_CACHE_KEY_TTL,
    cache_key_for_issue_view,
    get_issue_tsdb_group_model,
)
from sentry.issues.derived.features import STATUS, IssueStatus
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.issues.escalating.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.models.activity import Activity
from sentry.models.eventattachment import EventAttachment
from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import get_inbox_details
from sentry.models.grouplink import GroupLink
from sentry.models.groupowner import get_owner_details
from sentry.models.groupseen import GroupSeen
from sentry.models.groupsubscription import GroupSubscriptionManager
from sentry.models.userreport import UserReport
from sentry.ratelimits.config import RateLimitConfig
from sentry.sentry_apps.api.serializers.platform_external_issue import (
    PlatformExternalIssueSerializer,
)
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.tasks.post_process import fetch_buffered_group_stats
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.utils.http import is_mcp_request

logger = logging.getLogger(__name__)


def get_group_global_count(group: Group) -> str:
    fetch_buffered_group_stats(group)
    return str(group.times_seen_with_pending)


_GROUP_STATUS_TO_DERIVED_STATUS = {
    GroupStatus.UNRESOLVED: IssueStatus.OPEN,
    GroupStatus.RESOLVED: IssueStatus.CLOSED,
    GroupStatus.IGNORED: IssueStatus.CLOSED,
}


@extend_schema(tags=["Events"])
@cell_silo_endpoint
class GroupDetailsEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
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
    )

    def _get_seen_by(self, request: Request, group: Group) -> list[dict[str, Any]]:
        seen_by = list(GroupSeen.objects.filter(group=group).order_by("-last_seen"))
        return [seen for seen in serialize(seen_by, request.user) if seen is not None]

    def _reconcile_status(self, request: Request, group: Group) -> None:
        """Detect divergence between the Group model status (source of truth) and
        the action-log-derived status and publish a ReconcileStatusAction to fix it.

        This is a best-effort, non-essential side effect on a read path; callers
        must ensure a failure here never breaks the group view.
        """
        if not features.has("projects:issue-status-reconciliation", group.project):
            return

        expected_status = _GROUP_STATUS_TO_DERIVED_STATUS.get(group.status)
        if expected_status is None:
            # XXX: some statuses like pending deletion, merge, etc. are skipped
            # as they don't map to a derived status
            return

        derived = GroupDerivedData.objects.filter(group_id=group.id).first()
        if derived is None:
            # nothing to reconcile against
            return

        raw = derived.data.get(STATUS.name)
        derived_status = STATUS.from_json(raw) if raw is not None else STATUS.initial_value()
        if derived_status == expected_status:
            return

        metrics.incr(
            "issues.status_reconciliation.diverged",
            sample_rate=1.0,
            tags={
                "derived_status": derived_status.value,
                "expected_status": expected_status.value,
            },
        )
        # Status reconciliation is disabled for now; log divergences so we can
        # find and investigate these cases automatically instead of publishing a
        # ReconcileStatusAction.
        logger.info(
            "issues.status_reconciliation.diverged",
            extra={
                "group_id": group.id,
                "project_id": group.project_id,
                "derived_status": derived_status.value,
                "expected_status": expected_status.value,
            },
        )

    @staticmethod
    def __group_hourly_daily_stats(
        group: Group, environment_ids: Sequence[int]
    ) -> tuple[list[list[float]], list[list[float]]]:
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

    def finalize_response(
        self,
        request: Request,
        response: Response,
        *args: Any,
        **kwargs: Any,
    ) -> Response:
        response = super().finalize_response(request, response, *args, **kwargs)

        group = kwargs.get("group")
        send_issue_view_attribution(request, response, group)

        return response

    @extend_schema(
        operation_id="getOrganizationIssue",
        summary="Retrieve an Issue",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
            GlobalParams.ENVIRONMENT,
            IssueParams.GROUP_DETAILS_EXPAND,
            IssueParams.GROUP_DETAILS_COLLAPSE,
        ],
        responses={
            200: inline_sentry_response_serializer("GroupDetailsResponse", GroupDetailsResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueExamples.GROUP_DETAILS,
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-details",
        url_names=["sentry-api-0-group-details"],
    )
    def get(self, request: Request, group: Group) -> Response[GroupDetailsResponse]:
        """
        Return details on an individual issue, including its basic stats, comment
        and user-report counts, and a summary of the latest event.
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
            data: GroupDetailsResponse = serialize(
                group,
                request.user,
                GroupSerializerSnuba(environment_ids=environment_ids, expand=expand),
            )

            # TODO: these probably should be another endpoint
            activity = Activity.objects.get_activities_for_group(group, 100)
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

            if "inbox" in expand:
                inbox_map = get_inbox_details([group])
                inbox_reason = inbox_map.get(group.id)
                data.update({"inbox": inbox_reason})

            if "owners" in expand:
                owner_details = get_owner_details([group])
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
                    list(external_issues),
                    request.user,
                    serializer=ExternalIssueSerializer(),
                )
                data.update({"integrationIssues": integration_issues})

            if "sentryAppIssues" in expand:
                platform_external_issues = PlatformExternalIssue.objects.filter(group_id=group.id)
                sentry_app_issues = serialize(
                    list(platform_external_issues),
                    request.user,
                    serializer=PlatformExternalIssueSerializer(),
                )
                data.update({"sentryAppIssues": sentry_app_issues})

            if "latestEventHasAttachments" in expand:
                if not features.has(
                    "organizations:event-attachments",
                    group.project.organization,
                    actor=request.user,
                ):
                    metrics.incr(
                        "group.get.http_response",
                        sample_rate=1.0,
                        tags={
                            "status": 404,
                            "detail": "group_details:get:no_attachments_feature_flag",
                        },
                    )
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
                    "userReportCount": user_reports.count(),
                    "count": get_group_global_count(group),
                }
            )

            if "stats" not in collapse:
                hourly_stats, daily_stats = self.__group_hourly_daily_stats(group, environment_ids)
                data["stats"] = {"24h": hourly_stats, "30d": daily_stats}

            participants = user_service.serialize_many(
                filter={"user_ids": GroupSubscriptionManager.get_participating_user_ids(group)},
                as_user=request.user,
            )

            for participant in participants:
                participant["type"] = "user"

            data.update({"participants": participants})

            publish_action(
                ViewAction(),
                source=resolve_action_source(request),
                group_id=group.id,
                project=group.project,
                actor=resolve_action_actor(request),
            )

            try:
                self._reconcile_status(request, group)
            except Exception:
                logger.exception("group.details.get.reconcile_status_failed")

            metrics.incr(
                "group.get.http_response",
                sample_rate=1.0,
                tags={"status": 200, "detail": "group_details:get:response"},
            )
            return Response(data)
        except snuba.RateLimitExceeded:
            metrics.incr(
                "group.get.http_response",
                sample_rate=1.0,
                tags={"status": 429, "detail": "group_details:get:snuba.RateLimitExceeded"},
            )
            raise
        except Exception:
            metrics.incr(
                "group.get.http_response",
                sample_rate=1.0,
                tags={"status": 500, "detail": "group_details:get:Exception"},
            )
            raise

    @extend_schema(
        operation_id="updateOrganizationIssue",
        summary="Update an Issue",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
        ],
        request=GroupValidator,
        responses={
            200: inline_sentry_response_serializer(
                "GroupUpdateResponse", BaseGroupSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-details",
        url_names=["sentry-api-0-group-details"],
    )
    def put(
        self, request: Request, group: Group
    ) -> Response[BaseGroupSerializerResponse] | Response[DetailResponse]:
        """
        Update an individual issue's attributes. Only the attributes submitted
        are modified.
        """
        try:
            discard = request.data.get("discard")
            project = group.project
            search_fn = functools.partial(prep_search, request, project)
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

            serialized: BaseGroupSerializerResponse = serialize(
                group,
                request.user,
                GroupSerializer(
                    environment_func=get_environment_func(request, group.project.organization_id)
                ),
            )
            metrics.incr(
                "group.update.http_response",
                sample_rate=1.0,
                tags={"status": 200, "detail": "group_details:update:Response"},
            )
            return Response(serialized, status=response.status_code)
        except client.ApiError as e:
            metrics.incr(
                "group.update.http_response",
                sample_rate=1.0,
                tags={"status": e.status_code, "detail": "group_details:update:Response"},
            )
            logger.exception(
                "group_details:put client.ApiError",
            )
            # client.ApiError.body is opaque (proxied from another service);
            # cast is sanctioned for this opaque-body cohort per the spec.
            body = cast(BaseGroupSerializerResponse, e.body)
            return Response(body, status=e.status_code)

    @extend_schema(
        operation_id="deleteOrganizationIssue",
        summary="Remove an Issue",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
        ],
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-details",
        url_names=["sentry-api-0-group-details"],
    )
    def delete(self, request: Request, group: Group) -> Response[None]:
        """
        Asynchronously queue an individual issue for deletion.
        """
        from sentry.utils import snuba

        try:
            delete_group_list(request, group.project, [group], "delete")

            metrics.incr(
                "group.delete.http_response",
                sample_rate=1.0,
                tags={"status": 200, "detail": "group_details:delete:Response"},
            )
            return Response(status=202)
        except snuba.RateLimitExceeded:
            metrics.incr(
                "group.delete.http_response",
                sample_rate=1.0,
                tags={"status": 429, "detail": "group_details:delete:snuba.RateLimitExceeded"},
            )
            raise
        except Exception:
            metrics.incr(
                "group.delete.http_response",
                sample_rate=1.0,
                tags={"status": 500, "detail": "group_details:delete:Exception"},
            )
            raise


def send_issue_view_attribution(request: Request, response: Response, group: Any) -> None:
    if request.method != "GET":
        return

    if response.status_code < 200 or response.status_code >= 300:
        return

    if not isinstance(group, Group):
        return

    if is_mcp_request(request):
        client_family = request.headers.get("x-sentry-mcp-client-family") or "unknown"
        analytics.record(
            IssueViewedEvent(
                organization_id=group.project.organization_id,
                project_id=group.project.id,
                group_id=group.id,
                client=f"mcp - {client_family}",
                user_id=request.user.id,
            )
        )
        if features.has("organizations:mcp-issue-view-attribution", group.project.organization):
            cache.set(
                cache_key_for_issue_view(group.id, "mcp"), client_family, ISSUE_VIEW_CACHE_KEY_TTL
            )
