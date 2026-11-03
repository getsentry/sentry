from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.api.permissions import StaffPermission
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.autofix.autofix_agent import trigger_autofix_agent
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.exceptions import NoSeerQuotaException
from sentry.seer.autofix.steps import AutofixStep
from sentry.seer.autofix.utils import get_automation_handoff
from sentry.seer.models import SeerPermissionError
from sentry.viewer_context import Actor, ActorType, ViewerContext, viewer_context_scope


class AdminAutofixSingleRunSerializer(serializers.Serializer):
    organization_slug = serializers.CharField()
    short_id = serializers.CharField()


# TEMPORARY: lets staff test single-run Autofix in prod before orgs are flagged.
# Remove once single runs roll out (AIML-3812).
@internal_cell_silo_endpoint
class SeerAdminAutofixSingleRunEndpoint(Endpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (StaffPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request) -> Response:
        serializer = AdminAutofixSingleRunSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        slug: str = serializer.validated_data["organization_slug"]
        try:
            organization = Organization.objects.get(slug=slug)
            group = Group.objects.by_qualified_short_id(
                organization.id, serializer.validated_data["short_id"], project_ids=None
            )
        except (Organization.DoesNotExist, Group.DoesNotExist):
            return Response({"detail": "Issue not found"}, status=404)

        if get_automation_handoff(group.project.get_option) is not None:
            return Response(
                {"detail": "Projects with a coding agent configured can't start single runs"},
                status=400,
            )

        with viewer_context_scope(
            ViewerContext(
                actor=Actor(type=ActorType.USER, actor_id=request.user.id),
                organization_id=organization.id,
            )
        ):
            try:
                run = trigger_autofix_agent(
                    group=group,
                    step=AutofixStep.ROOT_CAUSE,
                    referrer=AutofixReferrer.ADMIN,
                    user=request.user,
                    actor_user_id=request.user.id,
                    single_run=True,
                )
            except NoSeerQuotaException:
                return Response({"detail": "Organization has no Seer quota"}, status=400)
            except SeerPermissionError as e:
                return Response({"detail": str(e)}, status=400)

        return Response(
            {
                "group_id": group.id,
                "project_id": group.project_id,
                "run_id": run.seer_run_state_id,
                "url": organization.absolute_url(
                    f"/organizations/{slug}/issues/{group.id}/autofix/",
                    query=f"project={group.project_id}&explorerRunId={run.seer_run_state_id}",
                ),
            }
        )
