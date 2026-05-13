from __future__ import annotations

import logging

import sentry_sdk
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_utils import (
    has_seer_agent_access_with_detail,
    snapshot_to_markdown,
)
from sentry.seer.models import SeerApiError, SeerPermissionError
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json

logger = logging.getLogger(__name__)


_CODE_MODE_VALUES = frozenset({"off", "on", "only"})


class CodeModeField(serializers.Field):
    """Accepts 'off'|'on'|'only' strings, or booleans for backwards compat.

    DRF's CharField rejects raw booleans before the field-level validator
    runs, so we handle coercion in to_internal_value instead.
    """

    def to_internal_value(self, data: object) -> str | None:
        if data is None:
            return None
        if data is True:
            return "on"
        if data is False:
            return "off"
        if isinstance(data, str):
            lowered = data.lower()
            if lowered in ("true",):
                return "on"
            if lowered in ("false",):
                return "off"
            if lowered in _CODE_MODE_VALUES:
                return lowered
        raise serializers.ValidationError(
            f"Invalid value '{data}'. Must be 'off', 'on', 'only', or a boolean."
        )

    def to_representation(self, value: object) -> str | None:
        if value is None:
            return None
        return str(value)


class SeerAgentChatSerializer(serializers.Serializer):
    query = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text="The user's query to send to the Seer Agent.",
    )
    insert_index = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Optional index to insert the message at.",
    )
    on_page_context = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Optional context from the user's screen.",
    )
    page_name = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
        help_text="The UI page name where the request originated (e.g., route string).",
    )
    override_ce_enable = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Override context engine rollout flag (applies to reasoning platform only).",
    )
    override_code_mode_enable = CodeModeField(
        required=False,
        default=None,
        allow_null=True,
        help_text="Override code mode tools: 'off', 'on', 'only', or boolean for backwards compat.",
    )
    ui_tools = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
        help_text="JSON-encoded tool definitions for client-side UI tools.",
    )


class OrganizationSeerAgentChatPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
    }


@cell_silo_endpoint
class OrganizationSeerAgentChatEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=25, window=60),
                RateLimitCategory.USER: RateLimit(limit=25, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60 * 60),
            },
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=100, window=60),
                RateLimitCategory.USER: RateLimit(limit=100, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=1000, window=60),
            },
        }
    )
    permission_classes = (OrganizationSeerAgentChatPermission,)

    def get(
        self, request: Request, organization: Organization, run_id: int | None = None
    ) -> Response:
        """
        Get the current state of a Seer Agent session.
        """
        has_access, error = has_seer_agent_access_with_detail(organization, request.user)

        has_seer_access, _ = has_seer_access_with_detail(organization, request.user)
        has_dashboards_ai_generate_access = has_seer_access and features.has(
            "organizations:dashboards-ai-generate", organization, actor=request.user
        )

        if not has_access and not has_dashboards_ai_generate_access:
            raise PermissionDenied(error)

        if not run_id:
            return Response({"session": None}, status=404)

        try:
            client = SeerAgentClient(organization, request.user)
            state = client.get_run(run_id=int(run_id))
            return Response({"session": state.dict()})
        except SeerPermissionError as e:
            raise PermissionDenied(e.message) from e
        except SeerApiError as e:
            sentry_sdk.capture_exception(e)
            if e.status == 404:
                return Response({"session": None}, status=404)
            return Response(
                {"detail": "Failed to fetch run state"},
                status=500,
            )
        except ValueError:
            logger.exception("Error getting agent run state")
            return Response({"session": None}, status=404)

    def post(
        self, request: Request, organization: Organization, run_id: int | None = None
    ) -> Response:
        """
        Start a new chat session or continue an existing one.

        Parameters:
        - run_id: Optional session ID to continue an existing session (from URL).
        - query: The user's query.
        - insert_index: Optional index to insert the message at.
        - on_page_context: Optional context from the user's screen.

        Returns:
        - run_id: The run ID.
        """
        has_access, error = has_seer_agent_access_with_detail(organization, request.user)

        has_seer_access, _ = has_seer_access_with_detail(organization, request.user)
        has_dashboards_ai_generate_access = has_seer_access and features.has(
            "organizations:dashboards-ai-generate", organization, actor=request.user
        )
        # Orgs with dashboards AI generate access can continue existing dashboard generate runs, but cannot start new runs from this endpoint.
        can_continue_dashboards_generate_run = (
            has_dashboards_ai_generate_access and run_id is not None
        )

        if not has_access and not can_continue_dashboards_generate_run:
            raise PermissionDenied(error)

        serializer = SeerAgentChatSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated_data = serializer.validated_data
        query = validated_data["query"]
        insert_index = validated_data.get("insert_index")
        on_page_context = validated_data.get("on_page_context")
        page_name = validated_data.get("page_name")
        override_ce_enable = validated_data["override_ce_enable"]
        override_code_mode_enable = validated_data.get("override_code_mode_enable")
        ui_tools = (
            validated_data.get("ui_tools")
            if features.has(
                "organizations:seer-explorer-ui-tools", organization, actor=request.user
            )
            else None
        )

        # If the frontend sent a structured LLMContext JSON snapshot, convert to markdown.
        if on_page_context:
            try:
                snapshot = json.loads(on_page_context)
                if isinstance(snapshot, dict) and "nodes" in snapshot:
                    on_page_context = snapshot_to_markdown(snapshot)
            except (json.JSONDecodeError, TypeError, AttributeError):
                pass

        try:
            enable_coding = organization.get_option(
                "sentry:enable_seer_coding", False
            ) and features.has(
                "organizations:seer-explorer-chat-coding", organization, actor=request.user
            )
            has_code_mode_feature = features.has(
                "organizations:seer-explorer-code-mode-tools", organization, actor=request.user
            )
            if not has_code_mode_feature:
                enable_code_mode_tools = "off"
            elif override_code_mode_enable is not None:
                enable_code_mode_tools = override_code_mode_enable
            else:
                enable_code_mode_tools = "on"
            client = SeerAgentClient(
                organization,
                request.user,
                is_interactive=True,
                enable_coding=enable_coding,
                enable_code_mode_tools=enable_code_mode_tools,
                reasoning_effort="medium",
            )
            if run_id:
                # Continue existing conversation
                result_run_id = client.continue_run(
                    run_id=int(run_id),
                    prompt=query,
                    insert_index=insert_index,
                    on_page_context=on_page_context,
                    page_name=page_name,
                    ui_tools=ui_tools,
                    request=request,
                )
            else:
                # Start new conversation
                result_run_id = client.start_run(
                    prompt=query,
                    on_page_context=on_page_context,
                    page_name=page_name,
                    ui_tools=ui_tools,
                    override_ce_enable=override_ce_enable,
                    request=request,
                )

            return Response({"run_id": result_run_id})
        except SeerPermissionError as e:
            raise PermissionDenied(e.message) from e
        except SeerApiError as e:
            sentry_sdk.capture_exception(e)
            return Response(
                {"detail": "Failed to start or continue chat session"},
                status=500,
            )
