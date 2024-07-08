from __future__ import annotations

from typing import TYPE_CHECKING

from sentry import features
from sentry.uptime.detectors.ranking import add_base_url_to_rank
from sentry.uptime.detectors.url_extraction import extract_base_url
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.models.project import Project


def detect_base_url_for_project(project: Project, url: str) -> None:
    if not features.has("organizations:uptime-automatic-hostname-detection", project.organization):
        return

    base_url = extract_base_url(url)
    if base_url is None:
        return

    add_base_url_to_rank(project, base_url)
    metrics.incr("uptime.url_added_to_rank")
