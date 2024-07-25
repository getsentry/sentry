from __future__ import annotations

from typing import TYPE_CHECKING

from sentry import features
from sentry.uptime.detectors.ranking import (
    add_base_url_to_rank,
    should_detect_for_organization,
    should_detect_for_project,
)
from sentry.uptime.detectors.url_extraction import extract_base_url
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.models.project import Project


def detect_base_url_for_project(project: Project, url: str) -> None:
    # Note: We might end up removing the `should_detect_for_project` check here if/when we decide to use detected
    # urls as suggestions as well.
    if (
        not features.has("organizations:uptime-automatic-hostname-detection", project.organization)
        or not should_detect_for_project(project)
        or not should_detect_for_organization(project.organization)
    ):
        metrics.incr("uptime.detectors.url_add_skipped_due_to_feature_flag")
        return

    base_url = extract_base_url(url)
    if base_url is None:
        return

    add_base_url_to_rank(project, base_url)
    metrics.incr("uptime.detectors.url_added_to_rank")
