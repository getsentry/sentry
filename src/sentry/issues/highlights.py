from typing import TypedDict

from sentry.models.project import Project
from sentry.utils.platform_categories import BACKEND, FRONTEND, MOBILE


class HighlightPreset(TypedDict):
    tags: list[str]
    context: list[str]


SENTRY_TAGS = ["handled", "level", "release", "environment"]

BACKEND_HIGHLIGHTS: HighlightPreset = {
    "tags": SENTRY_TAGS + ["url", "transaction", "status_code"],
    "context": ["trace", "runtime"],
}
FRONTEND_HIGHLIGHTS: HighlightPreset = {
    "tags": SENTRY_TAGS + ["url", "transaction", "browser", "replayId", "user"],
    "context": ["browser", "state"],
}
MOBILE_HIGHLIGHTS: HighlightPreset = {
    "tags": SENTRY_TAGS + ["mobile", "main_thread"],
    "context": ["profile", "app", "device"],
}

FALLBACK_HIGLIGHTS: HighlightPreset = {"tags": SENTRY_TAGS, "context": ["user", "trace"]}


def get_highlight_preset_for_project(project: Project) -> HighlightPreset:
    if not project.platform or project.platform == "other":
        return FALLBACK_HIGLIGHTS
    elif project.platform in FRONTEND:
        return FRONTEND_HIGHLIGHTS
    elif project.platform in BACKEND:
        return BACKEND_HIGHLIGHTS
    elif project.platform in MOBILE:
        return MOBILE_HIGHLIGHTS
    return FALLBACK_HIGLIGHTS
