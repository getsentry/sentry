from __future__ import annotations

from collections.abc import Sequence

from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.seer_run import (
    RunQuestionOutput,
    SeerRunResponse,
    SeerRunSerializer,
)
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.seer.agent.client_utils import has_seer_agent_access_with_detail
from sentry.seer.models.run import SeerRun, SeerRunType
from sentry.seer.run_questions import get_run_questions
from sentry.seer.runs_query import filtered_runs_queryset


def _fetch_run_outputs(
    runs: Sequence[SeerRun],
    organization: Organization,
    *,
    user_id: int | None,
) -> dict[int, list[RunQuestionOutput]]:
    qualifying = [
        run
        for run in runs
        if run.type == SeerRunType.EXPLORER and run.seer_run_state_id is not None
    ]
    if not qualifying:
        return {}

    answers_by_state_id = get_run_questions(
        [run.seer_run_state_id for run in qualifying],
        organization,
        user_id=user_id,
    )
    return {
        run.id: [
            {"key": q["key"], "answer": q["answer"]}
            for q in answers_by_state_id.get(run.seer_run_state_id, [])
        ]
        for run in qualifying
    }


class OrganizationSeerRunsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
    }


@cell_silo_endpoint
class OrganizationSeerRunsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    permission_classes = (OrganizationSeerRunsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List Seer runs for the organization, served from the Sentry-side mirror
        tables (``SeerRun``/``SeerAgentRun``).

        Returns all runs for the organization the caller can access by default
        (runs tied to projects the caller cannot access are excluded). Use
        ``is:mine`` in the query to scope results to the requesting user's runs.

        Query Parameters:
            query: Optional structured search string. Supports ``source``, ``type``,
                ``project``, ``is:agent``/``!is:agent``, ``is:mine``/``!is:mine``,
                and free-text title search.
            outputs: Optional boolean flag. When present, include one-shot outputs
                per run (requires the ``seer-run-questions`` feature).
        """
        has_access, error = has_seer_agent_access_with_detail(organization, request.user)
        if not has_access:
            raise PermissionDenied(error)

        include_outputs = "outputs" in request.GET and features.has(
            "organizations:seer-run-questions", organization, actor=request.user
        )

        query = request.GET.get("query", "").strip()
        accessible_project_ids = [
            p.id for p in self.get_projects(request, organization, include_all_accessible=True)
        ]

        # get_date_range_from_params raises InvalidParams (a DRF ParseError) on
        # bad date params, which DRF renders as a 400 on its own.
        start, end = get_date_range_from_params(request.GET, optional=True)

        try:
            queryset = filtered_runs_queryset(
                organization=organization,
                query=query,
                user_id=request.user.id,
                accessible_project_ids=accessible_project_ids,
                start=start,
                end=end,
            )
        except InvalidSearchQuery as e:
            # CodeQL complains about str(e) below but ~all handlers
            # of InvalidSearchQuery do the same as this.
            return Response({"detail": str(e)}, status=400)

        def on_results(runs: Sequence[SeerRun]) -> list[SeerRunResponse]:
            serialized: list[SeerRunResponse] = serialize(runs, request.user, SeerRunSerializer())
            if include_outputs:
                outputs_by_run_id = _fetch_run_outputs(runs, organization, user_id=request.user.id)
                for run, data in zip(runs, serialized):
                    data["outputs"] = outputs_by_run_id.get(run.id, [])
            return serialized

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-last_triggered_at",
            on_results=on_results,
            paginator_cls=OffsetPaginator,
            # Computing outputs is expensive (one one-shot per question per run),
            # so use a small default and cap the page size when they're requested.
            default_per_page=10 if include_outputs else 100,
            max_per_page=10 if include_outputs else 100,
        )
