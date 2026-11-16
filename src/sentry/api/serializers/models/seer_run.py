from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Annotated, Any, NotRequired, TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.pullrequest import (
    PullRequestSerializer,
    PullRequestSerializerResponse,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunPullRequest
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


# Within a run, outputs are ordered to match the questions that produced them
# (built-in set first, then user questions in request order), so callers
# correlate answers positionally; ``key`` and ``hash`` are just metadata.
class RunQuestionOutput(TypedDict):
    # Stable key for built-in questions; a synthetic ``user_<n>`` for user ones.
    key: Annotated[
        str, ApiDescription("Stable key for a built-in question, or `user_<n>` for a user one")
    ]
    # Short digest of the question text, always present.
    hash: Annotated[str, ApiDescription("Short digest of the question text")]
    # The one-shot's markdown answer.
    answer: Annotated[str, ApiDescription("Answer in Markdown")]
    # The question text, echoed back only for user-supplied questions.
    question: NotRequired[
        Annotated[str, ApiDescription("The question text. Only present for user questions")]
    ]


class SeerRunResponse(TypedDict):
    id: Annotated[str, ApiDescription("UUID of the run")]
    type: Annotated[
        str,
        ApiDescription(
            "Run type: `explorer`, `pr_review`, `assisted_query`, `feature_run` or `investigation`"
        ),
    ]
    userId: Annotated[str | None, ApiDescription("ID of the user who started the run")]
    lastTriggeredAt: Annotated[str, ApiDescription("When the run was last triggered")]
    dateCreated: Annotated[str, ApiDescription("When the run was created")]
    # Agent fields, null when the run has no SeerAgentRun row.
    title: Annotated[str | None, ApiDescription("Title of the agent run. Null for other runs")]
    source: Annotated[
        str | None, ApiDescription("Where the agent run started. Null for other runs")
    ]
    projectId: Annotated[str | None, ApiDescription("ID of the agent run's project, if any")]
    groupId: Annotated[str | None, ApiDescription("ID of the agent run's issue, if any")]
    pullRequests: Annotated[
        list[PullRequestSerializerResponse], ApiDescription("Pull requests the run opened")
    ]
    # One-shot outputs (question answers), injected by the endpoint when
    # ?expand=questions and/or ?question= is passed; the serializer itself never
    # populates them.
    outputs: NotRequired[
        Annotated[
            list[RunQuestionOutput],
            ApiDescription(
                "Answers to the requested questions, in question order. Only present with "
                "`expand=questions` or `question`"
            ),
        ]
    ]


@register(SeerRun)
class SeerRunSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[SeerRun], user: User | RpcUser | AnonymousUser, **kwargs: object
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
        serialized_pr_by_id = {
            pr.id: serialized
            for pr, serialized in zip(prs, serialize(prs, user, PullRequestSerializer()))
        }

        pull_requests_by_run_id: dict[int, list[PullRequestSerializerResponse]] = defaultdict(list)
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
        self,
        obj: SeerRun,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> SeerRunResponse:
        agent = cast(SeerAgentRun | None, attrs.get("agent"))
        pull_requests = cast(list[PullRequestSerializerResponse], attrs.get("pull_requests", []))
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
