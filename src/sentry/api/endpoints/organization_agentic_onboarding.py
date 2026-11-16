from typing import Any, Literal, NotRequired, TypedDict, get_args
from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry import analytics
from sentry.analytics.events.agentic_onboarding import (
    AgenticOnboardingRunCompletedEvent,
    AgenticOnboardingStageCompletedEvent,
    AgenticOnboardingStageStatusChangedEvent,
)
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.agentic_onboarding import (
    AgenticOnboardingRunSerializer,
)
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_GONE,
    RESPONSE_NOT_FOUND,
)
from sentry.auth.principal import require_user
from sentry.models.organization import Organization
from sentry.onboarding.agentic_progress.model import (
    MAX_EVENT_NOTE_LENGTH,
    STAGE_INDEX,
    ConnectionMethod,
    InvalidProgressUpdate,
    OnboardingRun,
    OnboardingRunExpired,
    OnboardingRunTerminal,
    ProgressUpdate,
    RunOrigin,
    RunStatus,
    Stage,
    StageExtra,
    StageStatus,
    get_stage_definition,
    validate_update,
)
from sentry.onboarding.agentic_progress.service import (
    RunNotFound,
    RunOwnershipMismatch,
    get_onboarding_progress_service,
)
from sentry.utils import metrics

INVALID_PROGRESS_UPDATE_DETAIL = "Invalid onboarding progress update"

StageValue = Literal[
    "connect_agent",
    "connect_mcp",
    "analyze_project",
    "create_project",
    "instrument_app",
    "plan_test_error",
    "send_verification_error",
    "receive_verification_error",
    "prepare_production",
    "check_stack_trace_quality",
]
StageStatusValue = Literal["active", "waiting", "completed", "skipped", "failed"]

STAGE_INPUT_ALIASES: dict[str, Stage] = {"connect_agent": Stage.CONNECT_MCP}


class AgenticOnboardingRunRequest(TypedDict):
    client_run_id: UUID
    onboarding_code: str | None
    origin: RunOrigin | None


class AgenticOnboardingStatusRequest(TypedDict):
    schema_version: int
    run_token: str
    stage: StageValue
    status: StageStatusValue
    run_status: NotRequired[Literal["completed", "failed"]]
    event_note: NotRequired[str]
    extra: NotRequired[dict[str, Any]]


class AgenticOnboardingStatusData(TypedDict):
    run_token: str
    stage_input: str
    update: ProgressUpdate[Any]


class AgenticOnboardingPermission(OrganizationPermission):
    scope_map = {"GET": ["org:read"], "POST": ["org:read"], "DELETE": ["org:read"]}

    def has_permission(self, request: Request, view: APIView) -> bool:
        return request.user.is_authenticated and super().has_permission(request, view)


class AgenticOnboardingRunRequestSerializer(CamelSnakeSerializer[AgenticOnboardingRunRequest]):
    client_run_id = serializers.UUIDField()
    onboarding_code = serializers.RegexField(r"^[A-Za-z0-9]{10}$", required=False, default=None)
    origin = serializers.ChoiceField(choices=list(RunOrigin), required=False, default=None)


class ConnectExtraSerializer(CamelSnakeSerializer[dict[str, Any]]):
    method = serializers.ChoiceField(choices=get_args(ConnectionMethod))


class CreateProjectExtraSerializer(CamelSnakeSerializer[dict[str, Any]]):
    project_slugs = serializers.ListField(child=serializers.SlugField())


class VerificationErrorExtraSerializer(CamelSnakeSerializer[dict[str, Any]]):
    issue_ids = serializers.ListField(child=serializers.CharField())


EXTRA_SERIALIZER_BY_STAGE = {
    Stage.CONNECT_MCP: ConnectExtraSerializer,
    Stage.CREATE_PROJECT: CreateProjectExtraSerializer,
    Stage.RECEIVE_VERIFICATION_ERROR: VerificationErrorExtraSerializer,
}


def deserialize_stage_extra(stage: Stage, value: dict[str, Any]) -> StageExtra:
    serializer_type = EXTRA_SERIALIZER_BY_STAGE.get(stage)
    if serializer_type is None:
        raise serializers.ValidationError(f"Extra data is not valid for the {stage.value} stage")

    serializer = serializer_type(data=value)
    unknown_fields = set(value) - set(serializer.fields)
    if unknown_fields:
        raise serializers.ValidationError(
            {field: "Unknown extra field" for field in sorted(unknown_fields)}
        )
    serializer.is_valid(raise_exception=True)
    return get_stage_definition(stage).parse_extra(serializer.validated_data)


class AgenticOnboardingStatusRequestSerializer(CamelSnakeSerializer[AgenticOnboardingStatusData]):
    schema_version = serializers.IntegerField(min_value=1, max_value=1)
    run_token = serializers.RegexField(r"^[A-Za-z0-9]{10}$")
    stage = serializers.ChoiceField(
        choices=[*(stage.value for stage in Stage), *STAGE_INPUT_ALIASES]
    )
    status = serializers.ChoiceField(
        choices=[
            stage_status.value
            for stage_status in StageStatus
            if stage_status is not StageStatus.BYPASSED
        ]
    )
    run_status = serializers.ChoiceField(
        choices=[RunStatus.COMPLETED.value, RunStatus.FAILED.value], required=False
    )
    event_note = serializers.CharField(
        required=False, allow_blank=False, max_length=MAX_EVENT_NOTE_LENGTH
    )
    extra = serializers.DictField(required=False, allow_empty=False)

    def validate(self, attrs: AgenticOnboardingStatusRequest) -> AgenticOnboardingStatusData:
        stage_input = attrs["stage"]
        stage = STAGE_INPUT_ALIASES.get(stage_input) or Stage(stage_input)
        update = ProgressUpdate(
            stage=stage,
            status=StageStatus(attrs["status"]),
            event_note=attrs.get("event_note"),
            extra=deserialize_stage_extra(stage, attrs["extra"]) if "extra" in attrs else None,
            run_status=(RunStatus(attrs["run_status"]) if "run_status" in attrs else None),
        )
        try:
            validate_update(update)
        except InvalidProgressUpdate as error:
            raise serializers.ValidationError({error.field.value: str(error)}) from error

        return {"run_token": attrs["run_token"], "stage_input": stage_input, "update": update}


def _connection_method(run: OnboardingRun) -> str | None:
    extra = get_stage_definition(Stage.CONNECT_MCP).extra_from(
        run.stages[STAGE_INDEX[Stage.CONNECT_MCP]]
    )
    return extra.method if extra is not None else None


def _record_progress_analytics(
    *,
    user_id: int,
    organization_id: int,
    run: OnboardingRun,
    update: ProgressUpdate[Any],
    changed: bool,
    stage_status_changed: bool,
) -> None:
    connection_method = _connection_method(run)

    if stage_status_changed:
        analytics.record(
            AgenticOnboardingStageStatusChangedEvent(
                user_id=user_id,
                organization_id=organization_id,
                run_id=run.run_id,
                origin=run.origin,
                stage=update.stage.value,
                status=update.status.value,
                connection_method=connection_method,
            )
        )

        if update.status is StageStatus.COMPLETED:
            analytics.record(
                AgenticOnboardingStageCompletedEvent(
                    user_id=user_id,
                    organization_id=organization_id,
                    run_id=run.run_id,
                    origin=run.origin,
                    stage=update.stage.value,
                    status=update.status.value,
                    connection_method=connection_method,
                )
            )

    if changed and run.run_status is RunStatus.COMPLETED:
        analytics.record(
            AgenticOnboardingRunCompletedEvent(
                user_id=user_id,
                organization_id=organization_id,
                run_id=run.run_id,
                origin=run.origin,
                status=run.run_status.value,
                connection_method=connection_method,
            )
        )


@cell_silo_endpoint
class OrganizationAgenticOnboardingRunIndexEndpoint(OrganizationEndpoint):
    permission_classes = (AgenticOnboardingPermission,)
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.VALUE_DISCOVERY

    @extend_schema(
        request=AgenticOnboardingRunRequestSerializer,
        responses={
            201: AgenticOnboardingRunSerializer,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
        },
    )
    def post(self, request: Request, organization: Organization) -> Response:
        serializer = AgenticOnboardingRunRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_id = require_user(request).id
        try:
            run, onboarding_code = get_onboarding_progress_service().create_or_resume(
                user_id=user_id,
                organization_id=organization.id,
                client_run_id=str(serializer.validated_data["client_run_id"]),
                onboarding_code=serializer.validated_data["onboarding_code"],
                origin=RunOrigin(serializer.validated_data["origin"])
                if serializer.validated_data["origin"] is not None
                else None,
            )
        except RunOwnershipMismatch:
            return Response({"detail": "Onboarding run not found"}, status=404)
        except ValueError:
            return Response({"detail": "Onboarding code is unavailable"}, status=409)

        return Response(
            serialize(
                run,
                request.user,
                AgenticOnboardingRunSerializer(),
                onboarding_code=onboarding_code,
            ),
            status=status.HTTP_201_CREATED,
        )


@cell_silo_endpoint
class OrganizationAgenticOnboardingStatusEndpoint(OrganizationEndpoint):
    permission_classes = (AgenticOnboardingPermission,)
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.VALUE_DISCOVERY

    @extend_schema(
        request=AgenticOnboardingStatusRequestSerializer,
        responses={
            200: AgenticOnboardingRunSerializer,
            400: RESPONSE_BAD_REQUEST,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
            410: RESPONSE_GONE,
        },
    )
    def post(self, request: Request, organization: Organization) -> Response:
        serializer = AgenticOnboardingStatusRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        user_id = require_user(request).id

        if values["update"].stage is Stage.CONNECT_MCP:
            metrics.incr(
                "agentic_onboarding.connect_stage_input",
                tags={"input": values["stage_input"]},
            )

        try:
            run, changed, stage_status_changed = get_onboarding_progress_service().update(
                token=values["run_token"],
                user_id=user_id,
                organization_id=organization.id,
                update=values["update"],
            )
        except (RunNotFound, RunOwnershipMismatch):
            return Response({"detail": "Onboarding run not found"}, status=404)
        except OnboardingRunExpired:
            return Response({"detail": "Onboarding run has expired"}, status=410)
        except OnboardingRunTerminal:
            return Response({"detail": "Onboarding run is terminal"}, status=409)
        except ValueError:
            return Response({"detail": INVALID_PROGRESS_UPDATE_DETAIL}, status=400)

        _record_progress_analytics(
            user_id=user_id,
            organization_id=organization.id,
            run=run,
            update=values["update"],
            changed=changed,
            stage_status_changed=stage_status_changed,
        )

        snapshot = serialize(run, request.user, AgenticOnboardingRunSerializer())
        return Response(snapshot)
