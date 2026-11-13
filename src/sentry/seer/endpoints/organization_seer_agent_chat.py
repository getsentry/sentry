from __future__ import annotations

import logging
from typing import Any

import sentry_sdk
from pydantic import BaseModel
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.auth.elevated_mode import has_elevated_mode
from sentry.auth.principal import acting_user, acting_user_id
from sentry.constants import ENABLE_SEER_CODING_DEFAULT
from sentry.demo_mode.utils import is_demo_mode_enabled, is_demo_org, is_demo_user
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.agent.client_utils import (
    chat_prompt_to_markdown,
    has_seer_agent_access_with_detail,
    snapshot_to_markdown,
)
from sentry.seer.autofix.constants import (
    AUTOFIX_RUN_SCOPES,
    PUBLISH_SCOPES,
    AutofixReferrer,
)
from sentry.seer.autofix.exceptions import SeerOutOfCreditsException
from sentry.seer.autofix.feature.dispatch import continue_single_run
from sentry.seer.autofix.feature.models import SINGLE_RUN_FEATURE_ID
from sentry.seer.autofix.prompt_redaction import redact_autofix_prompts
from sentry.seer.autofix.single_run import is_single_run
from sentry.seer.credits import SeerFeature, SeerOperation, can_run_seer_operation
from sentry.seer.endpoints.group_ai_autofix import RUN_IN_FLIGHT_CODE
from sentry.seer.endpoints.utils import (
    SEER_AGENT_CHAT_OUT_OF_CREDITS_DETAIL,
    SEER_OUT_OF_CREDITS_CODE,
    ResolvedSeerRun,
    resolve_seer_run,
)
from sentry.seer.models import SeerApiError, SeerPermissionError
from sentry.seer.models.run import SeerAgentRun
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json

logger = logging.getLogger(__name__)


_CODE_MODE_VALUES = frozenset({"off", "only"})

_DASHBOARD_GENERATE_RUN_SOURCE = "dashboard_generate"


class SeerAgentChatStateResponse(BaseModel):
    session: SeerRunState
    sentry_run_id: str | None
    feature_id: str | None = None


class CodeModeField(serializers.Field[str | None, str | None, str | None, object]):
    """Accepts 'off'|'only', plus the retired 'on' and booleans from stored frontend settings.

    True and 'on' read as 'only'. DRF's CharField rejects raw booleans before the field-level
    validator runs, so coercion happens in to_internal_value instead.
    """

    def to_internal_value(self, data: object) -> str | None:
        if data is None:
            return None
        if data is True:
            return "only"
        if data is False:
            return "off"
        if isinstance(data, str):
            lowered = data.lower()
            if lowered in ("true", "on"):
                return "only"
            if lowered in ("false",):
                return "off"
            if lowered in _CODE_MODE_VALUES:
                return lowered
        raise serializers.ValidationError(f"Invalid value '{data}'. Must be 'off' or 'only'.")

    def to_representation(self, value: object) -> str | None:
        if value is None:
            return None
        return str(value)


class PageLocationSerializer(serializers.Serializer):
    """Where the user was in the UI when they sent the message.

    Every field is optional: older clients omit the object entirely, and pages
    that cannot report a route still send a URL. Seer renders whatever arrives.
    """

    url = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    name = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    params = serializers.DictField(required=False, allow_null=True, default=None)
    query = serializers.DictField(required=False, allow_null=True, default=None)


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
    page_location = PageLocationSerializer(
        required=False,
        allow_null=True,
        default=None,
        help_text="Where the user was in the UI: url, route pattern, and route/query params.",
    )
    sent_at = serializers.ListField(
        child=serializers.CharField(max_length=64, allow_blank=True),
        required=False,
        allow_null=True,
        allow_empty=True,
        max_length=4,
        default=None,
        help_text=(
            "Client-rendered send times, e.g. local time with its zone name plus the "
            "same instant in UTC. Passed through to the agent as display strings."
        ),
    )
    override_bash_mode_enabled = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Override bash mode tools.",
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
        help_text="Override code mode tools: 'off' or 'only'.",
    )
    ui_tools = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
        help_text="JSON-encoded tool definitions for client-side UI tools.",
    )
    chat_prompt = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
        help_text="The question an 'Ask Seer' entry point showed the user, which this query answers.",
    )
    chat_prompt_context = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
        help_text="JSON-encoded context for the chat prompt: what the entry point was about.",
    )


class OrganizationSeerAgentChatPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
    }

    # Allow POST requests in demo mode to showcase Seer Agent
    DEMO_ALLOWED_METHODS = (*SAFE_METHODS, "POST")

    def has_permission(self, request: Request, view: APIView) -> bool:
        if is_demo_user(request.user):
            if not is_demo_mode_enabled() or request.method not in self.DEMO_ALLOWED_METHODS:
                return False
            return True
        return super().has_permission(request, view)

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        if is_demo_user(request.user):
            if not is_demo_mode_enabled() or request.method not in self.DEMO_ALLOWED_METHODS:
                return False
            org = obj.organization if hasattr(obj, "organization") else obj
            if not is_demo_org(org):
                return False
            return True
        return super().has_object_permission(request, view, obj)


def _is_dashboard_generate_run(organization: Organization, resolved: ResolvedSeerRun) -> bool:
    """A run that may be read or continued without explorer access.

    Explorer chats are not included, so a saved run_id stops working once open
    membership is turned off.
    """
    return SeerAgentRun.objects.filter(
        run__organization_id=organization.id,
        run__seer_run_state_id=resolved.seer_run_state_id,
        source=_DASHBOARD_GENERATE_RUN_SOURCE,
    ).exists()


def _maybe_reply_to_single_run(
    request: Request, organization: Organization, resolved: ResolvedSeerRun, reply: str
) -> Response | None:
    """Continue an Autofix single run with the reply; None if the run isn't one."""
    single_run = (
        SeerAgentRun.objects.filter(
            run__organization_id=organization.id,
            run__seer_run_state_id=resolved.seer_run_state_id,
            source=SINGLE_RUN_FEATURE_ID,
            group__isnull=False,
        )
        .select_related("run", "group__project")
        .first()
    )
    replier = acting_user(request.user)
    if single_run is None or single_run.group is None or replier is None:
        return None

    project = single_run.group.project
    if not request.access.has_any_project_scope(project, AUTOFIX_RUN_SCOPES):
        raise PermissionDenied("You do not have access to this run.")
    try:
        if (
            SeerAgentClient(organization, request.user)
            .get_run(run_id=resolved.seer_run_state_id)
            .status
            == "processing"
        ):
            return Response(
                {
                    "detail": "This run is still working",
                    "code": RUN_IN_FLIGHT_CODE,
                    "run_id": resolved.seer_run_state_id,
                    "sentry_run_id": resolved.uuid,
                },
                status=409,
            )
        continue_single_run(
            single_run,
            single_run.group,
            reply,
            user=replier,
            can_publish=request.access.has_any_project_scope(project, PUBLISH_SCOPES),
            referrer=AutofixReferrer.SEER_EXPLORER,
        )
    except SeerOutOfCreditsException:
        return Response(
            {"detail": SEER_AGENT_CHAT_OUT_OF_CREDITS_DETAIL, "code": SEER_OUT_OF_CREDITS_CODE},
            status=402,
        )
    except SeerApiError as e:
        if e.status == 404:
            return Response({"session": None}, status=404)
        sentry_sdk.capture_exception(e)
        return Response({"detail": "Failed to start or continue chat session"}, status=500)
    except ValueError:
        logger.exception("Error getting agent run state")
        return Response({"session": None}, status=404)
    return Response({"run_id": resolved.seer_run_state_id, "sentry_run_id": resolved.uuid})


@cell_silo_endpoint
class OrganizationSeerAgentChatEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
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
        self, request: Request, organization: Organization, run_id: str | None = None
    ) -> Response:
        """
        Get the current state of a Seer Agent session.
        """
        has_access, error = has_seer_agent_access_with_detail(organization, request.user)

        has_seer_access, _ = has_seer_access_with_detail(organization)

        if not run_id:
            if not has_access:
                raise PermissionDenied(error)
            return Response({"session": None}, status=404)

        if not has_access and not has_seer_access:
            raise PermissionDenied(error)

        resolved = resolve_seer_run(run_id, organization)
        if isinstance(resolved, Response):
            return resolved

        if not has_access and not _is_dashboard_generate_run(organization, resolved):
            raise PermissionDenied(error)

        try:
            client = SeerAgentClient(organization, request.user)
            state = client.get_run(run_id=resolved.seer_run_state_id)
            session = state if has_elevated_mode(request) else redact_autofix_prompts(state)
            return Response(
                SeerAgentChatStateResponse(
                    session=session,
                    sentry_run_id=resolved.uuid,
                    feature_id=SINGLE_RUN_FEATURE_ID if is_single_run(state) else None,
                ).dict()
            )
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
        self, request: Request, organization: Organization, run_id: str | None = None
    ) -> Response:
        """
        Start a new chat session or continue an existing one.

        Parameters:
        - run_id: Optional session ID to continue an existing session (from URL).
        - query: The user's query.
        - insert_index: Optional index to insert the message at.
        - on_page_context: Optional context from the user's screen.

        Returns:
        - run_id: The numeric Seer run id.
        - sentry_run_id: The run's UUID (when a mirror row exists).
        """
        has_access, error = has_seer_agent_access_with_detail(organization, request.user)

        has_seer_access, _ = has_seer_access_with_detail(organization)
        if not has_access and (run_id is None or not has_seer_access):
            raise PermissionDenied(error)

        serializer = SeerAgentChatSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated_data = serializer.validated_data
        query = validated_data["query"]
        insert_index = validated_data.get("insert_index")
        on_page_context = validated_data.get("on_page_context")
        page_name = validated_data.get("page_name")
        page_location = validated_data.get("page_location")
        sent_at = validated_data.get("sent_at")
        override_bash_mode_enabled = validated_data["override_bash_mode_enabled"]
        override_ce_enable = validated_data["override_ce_enable"]
        override_code_mode_enable = validated_data.get("override_code_mode_enable")
        ui_tools = validated_data.get("ui_tools")
        chat_prompt = validated_data.get("chat_prompt")
        chat_prompt_context = validated_data.get("chat_prompt_context")

        # If the frontend sent a structured LLMContext JSON snapshot, convert to markdown.
        if on_page_context:
            try:
                snapshot = json.loads(on_page_context)
                if isinstance(snapshot, dict) and "nodes" in snapshot:
                    on_page_context = snapshot_to_markdown(snapshot)
            except (json.JSONDecodeError, TypeError, AttributeError):
                pass

        # Stored on the user message for display; the agent sees it only as page context,
        # which Seer wraps as untrusted. Appended so the page's own lines stay first.
        prompt_metadata: dict[str, str] | None = None
        if chat_prompt and features.has(
            "organizations:seer-explorer-chat-prompts", organization, actor=request.user
        ):
            prompt_metadata = {"chat_prompt": chat_prompt}
            context: Any = None
            if chat_prompt_context:
                prompt_metadata["chat_prompt_context"] = chat_prompt_context
                try:
                    context = json.loads(chat_prompt_context)
                except json.JSONDecodeError:
                    context = chat_prompt_context
            section = chat_prompt_to_markdown(chat_prompt, context)
            on_page_context = f"{on_page_context}\n\n{section}" if on_page_context else section

        resolved: ResolvedSeerRun | None = None
        if run_id:
            user_id = acting_user_id(request.user)
            if user_id is None:
                raise PermissionDenied("A user account is required to continue a conversation.")
            result = resolve_seer_run(run_id, organization, for_continue=True, user_id=user_id)
            if isinstance(result, Response):
                return result
            resolved = result

            single_run_response = _maybe_reply_to_single_run(request, organization, resolved, query)
            if single_run_response is not None:
                return single_run_response

        is_dashboard_generate_run = resolved is not None and _is_dashboard_generate_run(
            organization, resolved
        )
        if not has_access and not is_dashboard_generate_run:
            raise PermissionDenied(error)
        # Do not bill for dashboard generation.
        if not is_dashboard_generate_run and not can_run_seer_operation(
            organization, SeerFeature.EXPLORER, SeerOperation.AGENT_CHAT_MESSAGE
        ):
            return Response(
                {"detail": SEER_AGENT_CHAT_OUT_OF_CREDITS_DETAIL, "code": SEER_OUT_OF_CREDITS_CODE},
                status=402,
            )

        try:
            # Seer only exposes write_pull_request when coding and bash mode are also on.
            has_create_pr = features.has(
                "organizations:ask-seer-create-pr", organization, actor=request.user
            )
            enable_coding = has_create_pr and organization.get_option(
                "sentry:enable_seer_coding", ENABLE_SEER_CODING_DEFAULT
            )

            has_code_mode_feature = features.has(
                "organizations:seer-explorer-code-mode-tools", organization, actor=request.user
            )
            if not has_code_mode_feature:
                enable_code_mode_tools = "off"
            elif override_code_mode_enable is not None:
                enable_code_mode_tools = override_code_mode_enable
            else:
                # Code Mode only, not alongside the classic tools: with both, the agent has
                # two ways to do everything and mixes them, so the surface being dogfooded is
                # never the one that ships. The frontend override can still turn it off for
                # comparison.
                enable_code_mode_tools = "only"

            client = SeerAgentClient(
                organization,
                request.user,
                is_interactive=True,
                enable_bash_mode=override_bash_mode_enabled or has_create_pr,
                enable_coding=enable_coding,
                enable_write_pull_request=has_create_pr,
                enable_code_mode_tools=enable_code_mode_tools,
                enable_investigation_tools=True,
                enable_inbox_tools=True,
                # Only users who can install integrations are asked to fix repo access.
                enable_scm_connect_prompt=features.has(
                    "organizations:ask-seer-scm-connect-prompt", organization, actor=request.user
                )
                and request.access.has_scope("org:integrations"),
                reasoning_effort="medium",
            )
            if resolved is not None:
                # Continue existing conversation
                client.continue_run(
                    run_id=resolved.seer_run_state_id,
                    prompt=query,
                    prompt_metadata=prompt_metadata,
                    insert_index=insert_index,
                    on_page_context=on_page_context,
                    page_name=page_name,
                    page_location=page_location,
                    sent_at=sent_at,
                    ui_tools=ui_tools,
                    request=request,
                )
                return Response(
                    {"run_id": resolved.seer_run_state_id, "sentry_run_id": resolved.uuid}
                )

            # Start new conversation
            run = client.start_run(
                prompt=query,
                prompt_metadata=prompt_metadata,
                on_page_context=on_page_context,
                page_name=page_name,
                page_location=page_location,
                sent_at=sent_at,
                ui_tools=ui_tools,
                override_ce_enable=override_ce_enable,
                request=request,
            )
            return Response({"run_id": run.seer_run_state_id, "sentry_run_id": str(run.uuid)})
        except SeerPermissionError as e:
            raise PermissionDenied(e.message) from e
        except SeerApiError as e:
            sentry_sdk.capture_exception(e)
            return Response(
                {"detail": "Failed to start or continue chat session"},
                status=500,
            )
