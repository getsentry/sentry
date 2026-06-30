from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.seer.models.run import SeerAgentRun, SeerRun


class SeerRunResponse(TypedDict):
    id: str
    seerRunId: str | None
    type: str
    userId: str | None
    lastTriggeredAt: str
    dateCreated: str
    extras: dict[str, Any]
    # Agent fields, null when the run has no SeerAgentRun row.
    title: str | None
    source: str | None
    projectId: str | None
    groupId: str | None
    agentExtras: dict[str, Any] | None


@register(SeerRun)
class SeerRunSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[SeerRun], user: Any, **kwargs: Any
    ) -> dict[SeerRun, dict[str, Any]]:
        # The reverse one-to-one accessor (``run.agent``) raises DoesNotExist when
        # absent, so map the agent rows explicitly rather than dereferencing it.
        agent_by_run_id = {
            agent.run_id: agent for agent in SeerAgentRun.objects.filter(run__in=item_list)
        }
        return {run: {"agent": agent_by_run_id.get(run.id)} for run in item_list}

    def serialize(
        self, obj: SeerRun, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> SeerRunResponse:
        agent: SeerAgentRun | None = attrs.get("agent")
        return {
            "id": str(obj.uuid),
            "seerRunId": str(obj.seer_run_state_id) if obj.seer_run_state_id is not None else None,
            "type": obj.type,
            "userId": str(obj.user_id) if obj.user_id is not None else None,
            "lastTriggeredAt": obj.last_triggered_at.isoformat(),
            "dateCreated": obj.date_added.isoformat(),
            "extras": obj.extras or {},
            "title": agent.title if agent is not None else None,
            "source": agent.source if agent is not None else None,
            "projectId": str(agent.project_id)
            if agent is not None and agent.project_id is not None
            else None,
            "groupId": str(agent.group_id)
            if agent is not None and agent.group_id is not None
            else None,
            "agentExtras": (agent.extras or {}) if agent is not None else None,
        }
