from __future__ import annotations

from typing import TYPE_CHECKING

from sentry import features

if TYPE_CHECKING:
    from sentry.models.project import Project


def should_auto_create_releases(project: Project) -> bool:
    """
    Whether releases may be created as a side effect of telemetry (events, spans,
    session health data) for this project. When the org has the feature flag and the
    project has disabled auto-creation, telemetry may only associate with releases
    that already exist (e.g. created via the CLI), never create new ones.
    """
    return not features.has("organizations:auto-release-creation", project.organization) or bool(
        project.get_option("sentry:enable_auto_release_creation")
    )
