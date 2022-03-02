from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.serializers import serialize
from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox
from sentry.utils.samples import create_sample_event


class ProjectCreateSampleEndpoint(ProjectEndpoint):
    # Members should be able to create sample events.
    # This is the same scope that allows members to view all issues for a project.
    permission_classes = (ProjectEventPermission,)

    def post(self, request: Request, project) -> Response:
        event = create_sample_event(
            project, platform=project.platform, default="javascript", tagged=True
        )
        add_group_to_inbox(event.group, GroupInboxReason.NEW)

        data = serialize(event, request.user)

        return Response(data)
