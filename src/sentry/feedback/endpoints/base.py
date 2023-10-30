from rest_framework.request import Request

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.feedback.models import Feedback


class ProjectFeedbackEndpoint(ProjectEndpoint):
    def convert_args(self, request: Request, feedback_id, *args, **kwargs):  # type: ignore[override]
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]

        if request.method != "DELETE" and not features.has(
            "organizations:user-feedback-ingest", project.organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        try:
            kwargs["feedback"] = Feedback.objects.get(
                project_id=project.id, feedback_id=feedback_id
            )
        except Feedback.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs
