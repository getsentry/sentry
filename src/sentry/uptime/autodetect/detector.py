from __future__ import annotations

from typing import int, TYPE_CHECKING

from sentry import options
from sentry.uptime.autodetect.ranking import (
    add_base_url_to_rank,
    should_autodetect_for_organization,
    should_autodetect_for_project,
)
from sentry.uptime.autodetect.url_extraction import extract_base_url
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.models.project import Project


def autodetect_base_url_for_project(project: Project, url: str) -> None:
    # Note: We might end up removing the `should_autodetect_for_project` check here if/when we decide to use
    # autodetected urls as suggestions as well.
    if (
        not options.get("uptime.automatic-hostname-detection")
        or not should_autodetect_for_project(project)
        or not should_autodetect_for_organization(project.organization)
    ):
        metrics.incr("uptime.detectors.url_add_skipped_due_to_feature_flag")
        return

    base_url = extract_base_url(url)
    if base_url is None:
        return

    add_base_url_to_rank(project, base_url)
    metrics.incr("uptime.detectors.url_added_to_rank")
