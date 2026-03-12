from __future__ import annotations

import logging

from sentry import features
from sentry.models.group import Group
from sentry.seer.autofix.artifact_schemas import RootCauseArtifact
from sentry.seer.explorer.client import SeerExplorerClient

logger = logging.getLogger(__name__)


def trigger_lightweight_rca(group: Group) -> int | None:
    """
    Trigger a lightweight Explorer RCA run for the given group.

    Uses a low-intelligence agent with limited iterations to quickly generate
    a root cause artifact. The result is stored as an Explorer run with
    category_key="lightweight_rca" for later evaluation.

    Args:
        group: The Sentry group (issue) to analyze

    Returns:
        The run ID if successful, None if the feature flag is off or an error occurred
    """
    if not features.has("projects:supergroup-lightweight-rca", group.project):
        return None

    try:
        client = SeerExplorerClient(
            organization=group.organization,
            project=group.project,
            user=None,
            intelligence_level="low",
            max_iterations=3,
            is_interactive=False,
            category_key="lightweight_rca",
            category_value=str(group.id),
            on_completion_hook=None,
        )

        short_id = group.qualified_short_id or str(group.id)
        title = group.title or "Unknown error"
        culprit = group.culprit or "unknown"

        prompt = (
            f'Analyze issue {short_id}: "{title}" (culprit: {culprit})\n\n'
            "Find the root cause of this issue. Use your tools to fetch issue details "
            "and examine the relevant code. Focus on identifying WHY the error happens, "
            "not on proposing fixes.\n\n"
            "Generate the root_cause artifact with:\n"
            "- one_line_description: A concise summary under 30 words\n"
            "- five_whys: Chain of brief 'why' statements leading to the root cause\n"
            "- reproduction_steps: Steps that would reproduce this issue"
        )

        run_id = client.start_run(
            prompt=prompt,
            prompt_metadata={"step": "root_cause"},
            artifact_key="root_cause",
            artifact_schema=RootCauseArtifact,
            metadata={"group_id": group.id},
        )
        return run_id
    except Exception:
        logger.exception(
            "lightweight_rca.trigger_failed",
            extra={
                "group_id": group.id,
                "organization_id": group.organization.id,
            },
        )
        return None
