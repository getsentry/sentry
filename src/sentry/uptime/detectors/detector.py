from __future__ import annotations

from sentry import features
from sentry.models.project import Project
from sentry.uptime.detectors.hostname_extraction import extract_hostname_from_url
from sentry.uptime.detectors.ranking import add_hostname_to_rank


def detect_hostname_for_project(project: Project, url: str) -> str | None:
    if not features.has("organizations:uptime-automatic-hostname-detection", project.organization):
        return

    hostname = extract_hostname_from_url(url)
    if hostname is None:
        return

    add_hostname_to_rank(project, hostname)
