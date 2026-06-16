from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEventPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.group_index import calculate_stats_period
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.utils import get_date_range_from_stats_period, handle_query_errors
from sentry.issues.endpoints.organization_group_index import (
    ERR_INVALID_STATS_PERIOD,
    search_and_serialize_issues,
    search_issues,
)
from sentry.models.organization import Organization
from sentry.seer.models import SeerApiError
from sentry.seer.supergroups.by_group import get_supergroups_by_group_ids

logger = logging.getLogger(__name__)


@cell_silo_endpoint
class OrganizationIssuesWithSupergroupsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationEventPermission,)
    enforce_rate_limit = True

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:top-issues-ui", organization, actor=request.user):
            return Response({"detail": "Feature not available"}, status=403)

        stats_period = request.GET.get("groupStatsPeriod")
        if stats_period not in (None, "", "24h", "14d", "auto"):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)

        try:
            limit = max(0, int(request.GET.get("limit") or 25))
        except ValueError:
            return Response({"detail": "invalid limit"}, status=400)

        start, end = get_date_range_from_stats_period(request.GET)
        stats_period, stats_period_start, stats_period_end = calculate_stats_period(
            stats_period, start, end
        )

        environments = self.get_environments(request, organization)
        projects = self.get_projects(request, organization)
        if not projects:
            return Response([])

        search_kwargs: dict[str, Any] = {
            "stats_period": stats_period,
            "stats_period_start": stats_period_start,
            "stats_period_end": stats_period_end,
            "start": start,
            "end": end,
            "expand": request.GET.getlist("expand", []),
            "collapse": request.GET.getlist("collapse", []),
        }

        # Our goal is to provide ~limit number of rows to the client, and deduplicate groups in the same supergroup.
        # When the client then goes to the next page, we don't want any of the previous rows we served to be sent.
        # We do this by overfetching 2x the limit, and then collapsing the supergroups, then running an additional
        # search to get the correct cursor. This means that a supergroup can appear across multiple pages,
        # but any particular group will only appear on one page.
        try:
            with handle_query_errors():
                # Overfetch 2x so supergroup collapse doesn't starve the page. Max out at 100.
                groups, cursor_result, _ = search_and_serialize_issues(
                    request,
                    organization,
                    projects,
                    environments,
                    limit=min(limit * 2, 100),
                    **search_kwargs,
                )

                if not groups:
                    return Response([])

                # If Seer is down, fall through to plain groups rather than
                # breaking the stream.
                try:
                    supergroup_data = get_supergroups_by_group_ids(
                        organization, [int(g["id"]) for g in groups], user_id=request.user.id
                    )
                except SeerApiError:
                    logger.exception("issues_with_supergroups.seer_fetch_failed")
                    supergroup_data = None

                rows, last_consumed = _combine_groups_and_supergroups(
                    groups,
                    supergroup_data,
                    limit,
                )
                # Re-run sized to what we actually consumed so its next cursor
                # sits at our page boundary, not past unemitted groups
                if last_consumed + 1 < len(groups):
                    cursor_result, _ = search_issues(
                        request,
                        organization,
                        projects,
                        environments,
                        {
                            "count_hits": True,
                            "date_to": end,
                            "date_from": start,
                            "limit": last_consumed + 1,
                        },
                    )
        except ValidationError as exc:
            return Response({"detail": str(exc)}, status=400)

        response = Response(rows)
        # X-Hits is the number of rows we're returning on this page. We skip
        # X-Max-Hits because cursor_result.max_hits counts raw matching groups,
        # which overstates the true blended-row total and we can't cheaply
        # compute the accurate one.
        response["X-Hits"] = len(rows)
        response["Link"] = ", ".join(
            [
                self.build_cursor_link(request, "previous", cursor_result.prev),
                self.build_cursor_link(request, "next", cursor_result.next),
            ]
        )
        return response


def _combine_groups_and_supergroups(
    groups: Sequence[Mapping[str, Any]],
    supergroup_data: Mapping[str, Any] | None,
    limit: int,
) -> tuple[list[Mapping[str, Any]], int]:
    sg_by_group_id: dict[int, Mapping[str, Any]] = {}
    if supergroup_data is not None:
        for sg in supergroup_data["data"]:
            for gid in sg["group_ids"]:
                sg_by_group_id[gid] = sg

    rows: list[Mapping[str, Any]] = []
    reps: dict[int, dict[str, Any]] = {}
    last_consumed = -1

    # For each group, we identify the supergroup it is in. If it is part of a supergroup that is higher up in the list,
    # we add it to the matchingGroups list of the supergroup. If it is new, we add it as a row and add it to the reps dictionary.
    # We continue until we would add a new row that exceeds the limit.
    for i, group in enumerate(groups):
        supergroup = sg_by_group_id.get(int(group["id"]))
        # Stop once we would add a new row that exceeds the limit. This would only happen if the new group row does not have a supergroup
        # or if the row would be a new supergroup we haven't already added.
        if len(rows) >= limit and (supergroup is None or supergroup["id"] not in reps):
            break
        if supergroup is None:
            rows.append(group)
        elif supergroup["id"] in reps:
            reps[supergroup["id"]]["matchingGroups"].append(group)
        else:
            rep: dict[str, Any] = {**group, "supergroup": supergroup, "matchingGroups": [group]}
            reps[supergroup["id"]] = rep
            rows.append(rep)
        last_consumed = i

    # Reps whose cluster surfaced only one member on this page become plain
    # groups — the page filter left nothing to collapse.
    for i, entry in enumerate(rows):
        if "matchingGroups" in entry and len(entry["matchingGroups"]) == 1:
            rows[i] = entry["matchingGroups"][0]

    return rows, last_consumed
