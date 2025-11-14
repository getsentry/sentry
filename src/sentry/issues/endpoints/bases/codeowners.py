from typing import int
from rest_framework.request import Request

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.utils import metrics


class ProjectCodeOwnersBase(ProjectEndpoint):
    def has_feature(self, request: Request, project: Project) -> bool:
        return bool(
            features.has(
                "organizations:integrations-codeowners", project.organization, actor=request.user
            )
        )

    def track_response_code(self, type: str, status: int | str) -> None:
        if type in ["create", "update"]:
            metrics.incr(
                f"codeowners.{type}.http_response",
                sample_rate=1.0,
                tags={"status": status},
            )
