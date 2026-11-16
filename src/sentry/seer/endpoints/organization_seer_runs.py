from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from drf_spectacular.utils import OpenApiParameter, extend_schema
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
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, VisibilityParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import acting_user_id
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_utils import has_seer_agent_access_with_detail
from sentry.seer.models.run import SeerRun, SeerRunType
from sentry.seer.run_questions import (
    QUESTIONS,
    Question,
    RunQuestion,
    build_user_questions,
    get_run_questions,
)

MAX_USER_QUESTIONS = 5
MAX_QUESTION_LENGTH = 4096


def _as_str_list(value: object) -> list[str]:
    """Coerce a JSON value into a list of strings (``None`` → empty, scalar → singleton)."""
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [v for v in value if isinstance(v, str)]
    return []


def _fetch_run_outputs(
    runs: Sequence[SeerRun],
    organization: Organization,
    *,
    questions: Sequence[Question],
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
        [run.seer_run_state_id for run in qualifying if run.seer_run_state_id is not None],
        organization,
        questions=questions,
        user_id=user_id,
    )

    def to_output(q: RunQuestion) -> RunQuestionOutput:
        output: RunQuestionOutput = {"key": q["key"], "hash": q["hash"], "answer": q["answer"]}
        # Echo the prompt back only for user questions; built-in prompts are internal.
        if q["user_supplied"]:
            output["question"] = q["question"]
        return output

    output: dict[int, list[RunQuestionOutput]] = {}
    for run in qualifying:
        state_id = run.seer_run_state_id
        assert state_id is not None
        output[run.id] = [to_output(q) for q in answers_by_state_id.get(state_id, [])]
    return output


class OrganizationSeerRunsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
    }


@extend_schema(tags=["Seer"])
@cell_silo_endpoint
class OrganizationSeerRunsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC_EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    permission_classes = (OrganizationSeerRunsPermission,)

    @extend_schema(
        operation_id="listOrganizationSeerRuns",
        summary="List an Organization's Seer Runs",
        description=(
            "Returns runs with no project and runs in projects the caller can access, most "
            "recently triggered first. With `expand=questions` or `question`, the page size "
            "defaults to and is capped at 10; otherwise it's 100."
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="query",
                location="query",
                required=False,
                type=str,
                description=(
                    "Search query. Supports `source`, `type`, `project`, `is:agent`/`!is:agent`, "
                    "`is:mine`/`!is:mine` and free-text title search."
                ),
            ),
            OpenApiParameter(
                name="expand",
                location="query",
                required=False,
                type=str,
                many=True,
                enum=["questions"],
                description=(
                    "Pass `questions` to add each run's answers to the built-in question set "
                    "in `outputs`. Ignored unless the organization has run questions enabled."
                ),
            ),
            OpenApiParameter(
                name="question",
                location="query",
                required=False,
                type=str,
                many=True,
                description=(
                    f"A question to answer about each run, up to {MAX_USER_QUESTIONS} of at most "
                    f"{MAX_QUESTION_LENGTH} characters. Answers follow the built-in ones in "
                    "`outputs`, in request order. Ignored unless the organization has run "
                    "questions enabled."
                ),
            ),
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            CursorQueryParam,
            VisibilityParams.PER_PAGE,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationSeerRunsResponse", list[SeerRunResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[SeerRunResponse]] | Response[DetailResponse]:
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
            expand: Optional repeatable flag. Pass ``expand=questions`` to include
                one-shot outputs for the built-in question set on each run
                (requires the ``seer-run-questions`` feature).
            question: Optional repeatable free-text question (also requires the
                feature). At most ``MAX_USER_QUESTIONS`` may be passed.

        ``expand=questions`` and ``question`` are additive: you may request the
        built-in set, user questions, both, or neither. Each run's ``outputs``
        list is returned in question order — the built-in set first (when
        expanded), then the ``question`` params in the order supplied — so
        correlate answers positionally. The per-output ``key`` and ``hash`` are
        supplementary metadata, not the primary correlation key.
        """
        start, end = get_date_range_from_params(request.GET, optional=True)
        return self._list_runs(
            request,
            organization,
            query=request.GET.get("query", "").strip(),
            expand=request.GET.getlist("expand"),
            questions=request.GET.getlist("question"),
            start=start,
            end=end,
        )

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Same as ``GET`` but reads its parameters (``query``, ``expand``,
        ``question``, and date range) from a JSON body. Prefer this when asking
        many or long questions that don't fit comfortably in a query string.
        Pagination (``cursor``) is still read from the query string.
        """
        data = request.data if isinstance(request.data, dict) else {}
        query = data.get("query", "")
        start, end = get_date_range_from_params(data, optional=True)
        return self._list_runs(
            request,
            organization,
            query=query.strip() if isinstance(query, str) else "",
            expand=_as_str_list(data.get("expand")),
            questions=_as_str_list(data.get("question")),
            start=start,
            end=end,
        )

    def _list_runs(
        self,
        request: Request,
        organization: Organization,
        *,
        query: str,
        expand: Sequence[str],
        questions: Sequence[str],
        start: datetime | None,
        end: datetime | None,
    ) -> Response:
        has_access, error = has_seer_agent_access_with_detail(organization, request.user)
        if not has_access:
            raise PermissionDenied(error)
        client = SeerAgentClient(organization, request.user)

        feature_enabled = features.has(
            "organizations:seer-run-questions", organization, actor=request.user
        )

        user_questions: list[str] = []
        include_builtin = False
        if feature_enabled:
            include_builtin = "questions" in expand
            user_questions = [q.strip() for q in questions if q.strip()]
            if len(user_questions) > MAX_USER_QUESTIONS:
                return Response(
                    {"detail": f"At most {MAX_USER_QUESTIONS} questions may be supplied."},
                    status=400,
                )
            if any(len(q) > MAX_QUESTION_LENGTH for q in user_questions):
                return Response(
                    {"detail": f"Questions may be at most {MAX_QUESTION_LENGTH} characters."},
                    status=400,
                )

        # The built-in set (expand=questions) and user questions are additive.
        # Built-ins come first so outputs stay ordered.
        run_questions: list[Question] = []
        if include_builtin:
            run_questions.extend(QUESTIONS)
        if user_questions:
            run_questions.extend(build_user_questions(user_questions))
        include_outputs = bool(run_questions)

        accessible_project_ids = [
            p.id for p in self.get_projects(request, organization, include_all_accessible=True)
        ]

        try:
            queryset = client.get_runs(
                query=query,
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
                outputs_by_run_id = _fetch_run_outputs(
                    runs,
                    organization,
                    questions=run_questions,
                    user_id=acting_user_id(request.user),
                )
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
