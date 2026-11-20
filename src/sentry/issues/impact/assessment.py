from __future__ import annotations

from sentry import features
from sentry.auth.principal import RequestPrincipal
from sentry.issues.impact.types import (
    IMPACT_FEATURE_ID,
    TYPED_CITATION_CONTRACT_VERSION,
    TYPED_CITATIONS_FEATURE,
    AvailableImpactCitation,
)
from sentry.models.group import Group
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models.run import SeerRun


class ImpactAssessmentDisabled(PermissionError):
    pass


class ImpactAssessmentEventNotFound(ValueError):
    pass


def assess_impact_for_group(*, group: Group, user: RequestPrincipal | None = None) -> SeerRun:
    if not features.has("organizations:seer-impact-assessment", organization=group.organization):
        raise ImpactAssessmentDisabled(
            "Seer Impact assessment is not enabled for this organization"
        )

    event = group.get_recommended_event() or group.get_latest_event()
    if event is None:
        raise ImpactAssessmentEventNotFound(
            f"Group {group.id} has no event available for Impact assessment"
        )

    source_event_id = event.event_id
    client = SeerAgentClient(group.organization, user=user, project=group.project, group=group)
    payload: dict[str, object] = {
        "group_id": group.id,
        "project_id": group.project_id,
        "source_event_id": source_event_id,
        # TODO(Leander): Allow users to enter custom project_context for better impact assessment
        "project_context": None,
    }
    extras: dict[str, object] = {"source_event_id": source_event_id}

    if features.has(TYPED_CITATIONS_FEATURE, organization=group.organization):
        # Seer cites what its tools actually read; there is no catalog to pick from.
        payload["citation_contract_version"] = TYPED_CITATION_CONTRACT_VERSION
        extras["citation_contract_version"] = TYPED_CITATION_CONTRACT_VERSION
    else:
        available_citations = [
            AvailableImpactCitation(source="event", reference=f"entire-event:{source_event_id}")
        ]
        payload["available_citations"] = available_citations
        extras["available_citation_references"] = [
            citation["reference"] for citation in available_citations
        ]

    return client.start_feature_run(
        feature_id=IMPACT_FEATURE_ID,
        payload=payload,
        title=f"Impact assessment for issue {group.id}",
        referrer=IMPACT_FEATURE_ID,
        flush=False,
        extras=extras,
    )
