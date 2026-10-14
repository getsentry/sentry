from __future__ import annotations

from sentry import features
from sentry.models.group import Group
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models.run import SeerRun

IMPACT_FEATURE_ID = "impact_assessment"


def assess_impact_for_group(group: Group) -> SeerRun:
    if not features.has("organizations:seer-impact-assessment", organization=group.organization):
        raise PermissionError("Seer Impact assessment is not enabled for this organization")

    event = group.get_recommended_event() or group.get_latest_event()
    if event is None:
        raise ValueError(f"Group {group.id} has no event available for Impact assessment")

    # TODO(Leander): Use the event to create stable references to event evidence for citations in the response.
    # For now, the ImpactCitation is arbitrary and can't really be used in practice.
    source_event_id = event.event_id
    client = SeerAgentClient(group.organization, project=group.project, group=group)
    return client.start_feature_run(
        feature_id=IMPACT_FEATURE_ID,
        payload={
            "group_id": group.id,
            "project_id": group.project_id,
            "source_event_id": source_event_id,
            # TODO(Leander): Allow users to enter custom project_context for better impact assessment
            "project_context": None,
        },
        title=f"Impact assessment for issue {group.id}",
        referrer=IMPACT_FEATURE_ID,
        flush=False,
        extras={
            "source_event_id": source_event_id,
        },
    )
