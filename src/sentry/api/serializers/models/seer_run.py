from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any, NotRequired, TypedDict, cast

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.pullrequest import (
    PullRequestSerializer,
    PullRequestSerializerResponse,
)
from sentry.models.pullrequest import PullRequest
from sentry.seer.autofix.pr_ci_status import PullRequestCiStatus, get_pr_ci_status
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunPullRequest


# Within a run, outputs are ordered to match the questions that produced them
# (built-in set first, then user questions in request order), so callers
# correlate answers positionally; ``key`` and ``hash`` are just metadata.
class RunQuestionOutput(TypedDict):
    # Stable key for built-in questions; a synthetic ``user_<n>`` for user ones.
    key: str
    # Short digest of the question text, always present.
    hash: str
    # The one-shot's markdown answer.
    answer: str
    # The question text, echoed back only for user-supplied questions.
    question: NotRequired[str]


# Seer-local extension so the shared response type (and other endpoints' schemas) stay untouched.
class SeerRunPullRequestResponse(PullRequestSerializerResponse):
    ciStatus: NotRequired[PullRequestCiStatus | None]


class SeerRunPullRequestSerializer(PullRequestSerializer):
    def __init__(self, include_ci_status: bool = False) -> None:
        self.include_ci_status = include_ci_status

    def serialize(
        self, obj: PullRequest, attrs: Any, user: Any, **kwargs: Any
    ) -> SeerRunPullRequestResponse:
        result: SeerRunPullRequestResponse = {**super().serialize(obj, attrs, user, **kwargs)}
        if self.include_ci_status:
            result["ciStatus"] = get_pr_ci_status(obj)
        return result


class SeerRunResponse(TypedDict):
    id: str
    type: str
    userId: str | None
    lastTriggeredAt: str
    dateCreated: str
    # Agent fields, null when the run has no SeerAgentRun row.
    title: str | None
    source: str | None
    projectId: str | None
    groupId: str | None
    pullRequests: list[SeerRunPullRequestResponse]
    # One-shot outputs (question answers), injected by the endpoint when
    # ?expand=questions and/or ?question= is passed; the serializer itself never
    # populates them.
    outputs: NotRequired[list[RunQuestionOutput]]


@register(SeerRun)
class SeerRunSerializer(Serializer):
    def __init__(self, include_ci_status: bool = False) -> None:
        self.include_ci_status = include_ci_status

    def get_attrs(
        self, item_list: Sequence[SeerRun], user: Any, **kwargs: Any
    ) -> dict[SeerRun, dict[str, Any]]:
        # The reverse one-to-one accessor (``run.agent``) raises DoesNotExist when
        # absent, so map the agent rows explicitly rather than dereferencing it.
        agent_by_run_id = {
            agent.run_id: agent for agent in SeerAgentRun.objects.filter(run__in=item_list)
        }

        # A PR is opened by exactly one run (unique link), so each PR appears
        # once; serialize them in one bulk pass through PullRequestSerializer.
        pr_links = list(
            SeerRunPullRequest.objects.filter(seer_run__in=item_list)
            .select_related("pull_request")
            .order_by("date_added")
        )
        prs = [link.pull_request for link in pr_links]
        pr_serializer = SeerRunPullRequestSerializer(include_ci_status=self.include_ci_status)
        # serialize()'s generic is bound by the base class, so re-narrow to the subclass response.
        serialized_prs = cast(list[SeerRunPullRequestResponse], serialize(prs, user, pr_serializer))
        serialized_pr_by_id = {pr.id: serialized for pr, serialized in zip(prs, serialized_prs)}

        pull_requests_by_run_id: dict[int, list[SeerRunPullRequestResponse]] = defaultdict(list)
        for link in pr_links:
            pull_requests_by_run_id[link.seer_run_id].append(
                serialized_pr_by_id[link.pull_request_id]
            )

        return {
            run: {
                "agent": agent_by_run_id.get(run.id),
                "pull_requests": pull_requests_by_run_id.get(run.id, []),
            }
            for run in item_list
        }

    def serialize(
        self, obj: SeerRun, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> SeerRunResponse:
        agent: SeerAgentRun | None = attrs.get("agent")
        pull_requests = attrs.get("pull_requests", [])
        return {
            "id": str(obj.uuid),
            "type": obj.type,
            "userId": str(obj.user_id) if obj.user_id is not None else None,
            "lastTriggeredAt": obj.last_triggered_at.isoformat(),
            "dateCreated": obj.date_added.isoformat(),
            "title": agent.title if agent is not None else None,
            "source": agent.source if agent is not None else None,
            "projectId": str(agent.project_id)
            if agent is not None and agent.project_id is not None
            else None,
            "groupId": str(agent.group_id)
            if agent is not None and agent.group_id is not None
            else None,
            "pullRequests": pull_requests,
        }
