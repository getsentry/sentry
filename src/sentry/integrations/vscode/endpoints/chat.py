from __future__ import annotations

from django.http import HttpResponse
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.integrations.vscode.endpoints.utils import (
    create_session_id,
    editor_response,
    format_editor_context,
    get_run_from_session_id,
    serialize_editor_state,
    validate_vscode_access,
)
from sentry.models.organization import Organization
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.entrypoints.operator import SeerAgentOperator
from sentry.seer.entrypoints.types import SeerEntrypointKey
from sentry.seer.entrypoints.vscode.entrypoint import VSCodeAgentEntrypoint
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus


class VSCodeChatSerializer(serializers.Serializer):
    message = serializers.CharField(allow_blank=False, max_length=100_000)
    editorContext = serializers.JSONField(required=False, allow_null=True, default=None)


@cell_silo_endpoint
class VSCodeChatEndpoint(OrganizationEndpoint):
    owner = ApiOwner.COMMUNITY
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    authentication_classes = ()
    permission_classes = ()

    def get(self, request: Request, organization: Organization, session_id: str) -> HttpResponse:
        """
        Polling session state
        """
        user_id = validate_vscode_access(request=request, organization=organization)
        try:
            run = get_run_from_session_id(
                organization=organization, user_id=user_id, session_id=session_id
            )
        except serializers.ValidationError as e:
            Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if run.mirror_status == SeerRunMirrorStatus.FAILED:
            return Response(
                editor_response(
                    run,
                    run.agent,
                    status="failed",
                    errors=["Seer could not start this session."],
                )
            )
        if run.seer_run_state_id is None:
            return Response(editor_response(run, run.agent, status="pending"))

        try:
            state = SeerAgentClient(organization, request.user).get_run(run.seer_run_state_id)
        except SeerApiError:
            return Response({"detail": "Failed to fetch editor session."}, status=502)
        return Response(serialize_editor_state(run, run.agent, state))

    def post(self, request: Request, organization: Organization) -> HttpResponse:
        """
        New chat session
        """
        user_id = validate_vscode_access(request=request, organization=organization)

        serializer = VSCodeChatSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        entrypoint = VSCodeAgentEntrypoint(organization_id=organization.id, user_id=user_id)
        operator = SeerAgentOperator(entrypoint=entrypoint)

        run_id = operator.trigger_agent(
            organization=organization,
            user=request.user,  # type: ignore[arg-type]
            prompt=serializer.validated_data["message"],
            on_page_context=format_editor_context(serializer.validated_data.get("editorContext")),
            category_key=SeerEntrypointKey.VSCODE.value,
            category_value=create_session_id(),
        )
        if run_id is None:
            return Response({"detail": "Failed to start editor session."}, status=500)

        run = (
            SeerRun.objects.filter(
                organization=organization,
                user_id=user_id,
                seer_run_state_id=run_id,
                agent__source=SeerEntrypointKey.VSCODE.value,
            )
            .select_related("agent")
            .first()
        )
        if run is None:
            return Response({"detail": "Failed to create editor session."}, status=500)
        return Response(
            editor_response(run, run.agent, status="running"),
            status=status.HTTP_201_CREATED,
        )
        return self.respond(status=status.HTTP_200_OK)

    def put(self, request: Request, organization: Organization, session_id: str) -> Response:
        """
        New message for an existing chat session
        """
        user_id = validate_vscode_access(request=request, organization=organization)
        try:
            run = get_run_from_session_id(
                organization=organization, user_id=user_id, session_id=session_id
            )
        except serializers.ValidationError as e:
            Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = VSCodeChatSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        category_value = run.agent.extras.get("category_value")
        if not isinstance(category_value, str):
            return Response({"detail": "Editor session metadata is invalid."}, status=500)

        entrypoint = VSCodeAgentEntrypoint(organization_id=organization.id, user_id=user_id)
        operator = SeerAgentOperator(entrypoint=entrypoint)
        continued_run_id = operator.trigger_agent(
            organization=organization,
            user=request.user,  # type: ignore[arg-type]
            prompt=serializer.validated_data["message"],
            on_page_context=format_editor_context(serializer.validated_data.get("editorContext")),
            category_key=SeerEntrypointKey.VSCODE.value,
            category_value=category_value,
        )
        if continued_run_id != run.seer_run_state_id:
            return Response({"detail": "Failed to continue editor session."}, status=500)
        return Response(editor_response(run, run.agent, status="running"), status=202)
