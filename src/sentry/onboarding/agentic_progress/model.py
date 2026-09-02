from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Generic, Literal, Self, TypeVar, overload

from pydantic import (
    BaseModel,
    StrictInt,
    StrictStr,
    ValidationError,
    validator,
)
from pydantic import (
    Extra as PydanticExtra,
)

SCHEMA_VERSION = 1
MAX_EVENT_NOTE_LENGTH = 256


class Stage(StrEnum):
    """Stages that can be progressed during agentic onboarding."""

    CONNECT_MCP = "connect_mcp"
    """Connect the setup agent to the user's Sentry account through MCP."""

    ANALYZE_PROJECT = "analyze_project"
    """Inspect the application and identify its platform, SDK, and setup needs."""

    CREATE_PROJECT = "create_project"
    """Select an existing Sentry project or create a project and obtain its DSN."""

    INSTRUMENT_APP = "instrument_app"
    """Install and configure the Sentry SDK in the application."""

    PLAN_TEST_ERROR = "plan_test_error"
    """Choose a representative test error and plan how to trigger it safely."""

    SEND_VERIFICATION_ERROR = "send_verification_error"
    """Trigger the planned test error in the instrumented application."""

    RECEIVE_VERIFICATION_ERROR = "receive_verification_error"
    """Wait for Sentry to ingest the test error and confirm that it was received."""

    PREPARE_PRODUCTION = "prepare_production"
    """Prepare the instrumentation and release configuration for production."""

    CHECK_STACK_TRACE_QUALITY = "check_stack_trace_quality"
    """Check source maps or debug symbols and confirm stack traces are readable."""


class StageStatus(StrEnum):
    """Current state of an onboarding stage."""

    ACTIVE = "active"
    """The agent is actively working on the stage."""

    WAITING = "waiting"
    """The agent needs user input or an external result before it can continue."""

    COMPLETED = "completed"
    """The agent observed that the stage completed successfully."""

    SKIPPED = "skipped"
    """The agent explicitly determined that an optional stage does not apply."""

    BYPASSED = "bypassed"
    """The backend inferred that progress advanced without a stage update."""

    FAILED = "failed"
    """The agent reported that the stage could not complete."""


class RunStatus(StrEnum):
    """Lifecycle state of the complete onboarding run."""

    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StageExtra(BaseModel):
    class Config:
        extra = PydanticExtra.forbid
        frozen = True

    def merge(self, incoming: Self) -> Self:
        raise NotImplementedError


class CreateProjectExtra(StageExtra):
    project_slugs: tuple[StrictStr, ...]

    def merge(self, incoming: Self) -> Self:
        return type(self)(project_slugs=_merge_unique(self.project_slugs, incoming.project_slugs))


class VerificationErrorExtra(StageExtra):
    issue_ids: tuple[StrictStr, ...]

    def merge(self, incoming: Self) -> Self:
        return type(self)(issue_ids=_merge_unique(self.issue_ids, incoming.issue_ids))


ExtraT = TypeVar("ExtraT", bound=StageExtra)
ItemT = TypeVar("ItemT")


def _merge_unique(current: tuple[ItemT, ...], incoming: tuple[ItemT, ...]) -> tuple[ItemT, ...]:
    return tuple(dict.fromkeys((*current, *incoming)))


class PersistedStageState(BaseModel):
    stage: StrictStr
    status: StrictStr | None
    event_note: StrictStr | None = None
    extra: dict[str, Any] | None = None

    class Config:
        extra = PydanticExtra.forbid


class PersistedOnboardingRun(BaseModel):
    run_id: StrictStr
    channel_id: StrictStr
    token_hash: StrictStr
    client_run_id: StrictStr
    user_id: StrictInt
    organization_id: StrictInt
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
    sequence: StrictInt
    stages: tuple[PersistedStageState, ...]
    run_status: StrictStr = RunStatus.ACTIVE
    schema_version: StrictInt

    class Config:
        extra = PydanticExtra.forbid

    @validator("created_at", "updated_at", "expires_at")
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must include a timezone")

        return value


@dataclass(frozen=True)
class StageDefinition(Generic[ExtraT]):
    """Static behavior for a stage in the ordered onboarding flow."""

    stage: Stage
    """Stage represented by this definition."""

    optional: bool = False
    """Whether later progress may leave this stage without a terminal status."""

    extra_type: type[ExtraT] | None = None
    """Structured extra data accepted by this stage, when it has any."""

    def state(
        self,
        *,
        status: StageStatus | None = None,
        event_note: str | None = None,
        extra: ExtraT | None = None,
    ) -> StageState[ExtraT]:
        return StageState(
            stage=self.stage,
            status=status,
            event_note=event_note,
            extra=extra,
        )

    def update(
        self,
        *,
        status: StageStatus,
        event_note: str | None = None,
        extra: ExtraT | None = None,
        run_status: RunStatus | None = None,
    ) -> ProgressUpdate[ExtraT]:
        return ProgressUpdate(
            stage=self.stage,
            status=status,
            event_note=event_note,
            extra=extra,
            run_status=run_status,
        )

    def extra_from(self, state: StageState[Any]) -> ExtraT | None:
        if state.stage is not self.stage:
            raise ValueError(f"Expected extra data for {self.stage.value}")
        if state.extra is None:
            return None
        if self.extra_type is None or not isinstance(state.extra, self.extra_type):
            raise ValueError(f"Invalid extra data for {self.stage.value}")

        return state.extra

    def extra_for_update(self, update: ProgressUpdate[Any]) -> ExtraT | None:
        if self.extra_type is None:
            if update.extra is not None:
                raise InvalidProgressUpdate(
                    ProgressUpdateField.EXTRA,
                    f"Extra data is not valid for the {self.stage.value} stage",
                )

            return None

        if update.extra is None:
            return None
        if not isinstance(update.extra, self.extra_type):
            raise InvalidProgressUpdate(
                ProgressUpdateField.EXTRA,
                f"Extra data is not valid for the {self.stage.value} stage",
            )
        return update.extra

    def parse_extra(self, value: object) -> ExtraT:
        if self.extra_type is None:
            raise ValueError(f"Extra data is not valid for {self.stage.value}")

        return self.extra_type.parse_obj(value)

    def deserialize_extra(self, value: object) -> ExtraT | None:
        if value is None:
            return None

        try:
            return self.parse_extra(value)
        except (ValidationError, ValueError) as error:
            raise InvalidOnboardingRun(f"Invalid extra data for {self.stage.value}") from error

    def merge_extra(self, current: ExtraT | None, incoming: ExtraT | None) -> ExtraT | None:
        if incoming is None:
            return current
        if current is None:
            return incoming
        if self.extra_type is None or not isinstance(current, self.extra_type):
            raise InvalidProgressUpdate(ProgressUpdateField.EXTRA, "Extra data type cannot change")

        return current.merge(incoming)


# Tuple order is the onboarding order and therefore part of the persisted schema.
STAGE_DEFINITIONS: tuple[StageDefinition[Any], ...] = (
    StageDefinition(Stage.CONNECT_MCP),
    StageDefinition(Stage.ANALYZE_PROJECT),
    StageDefinition(
        Stage.CREATE_PROJECT,
        extra_type=CreateProjectExtra,
    ),
    StageDefinition(Stage.INSTRUMENT_APP),
    StageDefinition(Stage.PLAN_TEST_ERROR),
    StageDefinition(Stage.SEND_VERIFICATION_ERROR),
    StageDefinition(
        Stage.RECEIVE_VERIFICATION_ERROR,
        extra_type=VerificationErrorExtra,
    ),
    StageDefinition(Stage.PREPARE_PRODUCTION),
    StageDefinition(Stage.CHECK_STACK_TRACE_QUALITY, optional=True),
)

STAGE_DEFINITION_BY_STAGE = {definition.stage: definition for definition in STAGE_DEFINITIONS}
STAGE_INDEX = {definition.stage: index for index, definition in enumerate(STAGE_DEFINITIONS)}


@overload
def get_stage_definition(
    stage: Literal[Stage.CREATE_PROJECT],
) -> StageDefinition[CreateProjectExtra]: ...


@overload
def get_stage_definition(
    stage: Literal[Stage.RECEIVE_VERIFICATION_ERROR],
) -> StageDefinition[VerificationErrorExtra]: ...


@overload
def get_stage_definition(stage: Stage) -> StageDefinition[Any]: ...


def get_stage_definition(stage: Stage) -> StageDefinition[Any]:
    return STAGE_DEFINITION_BY_STAGE[stage]


class InvalidOnboardingRun(ValueError):
    """Persisted onboarding state does not match the current schema."""


class ProgressUpdateField(StrEnum):
    """Input field responsible for an invalid progress update."""

    EVENT_NOTE = "event_note"
    STATUS = "status"
    EXTRA = "extra"
    RUN_STATUS = "run_status"


class InvalidProgressUpdate(ValueError):
    """A progress update violates a field-level domain constraint."""

    def __init__(self, field: ProgressUpdateField, message: str) -> None:
        self.field = field
        super().__init__(message)


class OnboardingRunExpired(ValueError):
    """The onboarding run has passed its absolute expiry."""


class OnboardingRunTerminal(ValueError):
    """The onboarding run no longer accepts progress updates."""


@dataclass(frozen=True)
class StageState(Generic[ExtraT]):
    """Persisted UI state for one onboarding stage."""

    stage: Stage
    """Stage represented by this state."""

    status: StageStatus | None = None
    """Latest status, or None before the stage begins."""

    event_note: str | None = None
    """Short user-visible detail for the latest update."""

    extra: ExtraT | None = None
    """Structured data whose type is selected by the stage definition."""


@dataclass(frozen=True)
class ProgressUpdate(Generic[ExtraT]):
    """Validated state transition reported by the onboarding tool."""

    stage: Stage
    """Stage whose state is changing."""

    status: StageStatus
    """New state for the stage."""

    event_note: str | None = None
    """Optional user-visible detail for the update."""

    extra: ExtraT | None = None
    """Structured extra data associated with this stage update."""

    run_status: RunStatus | None = None
    """Optional terminal transition for the complete run."""


@dataclass(frozen=True)
class OnboardingRun:
    """Complete ephemeral state for one browser-owned onboarding run."""

    run_id: str
    """Opaque identifier used by the browser polling endpoint."""

    channel_id: str
    """Stable Conduit channel shared by every snapshot for this run."""

    token_hash: str
    """HMAC of the short handoff token accepted from the onboarding tool."""

    client_run_id: str
    """Browser-generated identifier used to make registration resumable."""

    user_id: int
    """User that owns and may read or update the run."""

    organization_id: int
    """Organization within which the run is authorized."""

    created_at: datetime
    """Timezone-aware UTC time at which the run was registered."""

    updated_at: datetime
    """Timezone-aware UTC time of the latest state change."""

    expires_at: datetime
    """Absolute timezone-aware UTC expiry that updates never extend."""

    sequence: int
    """Monotonic version used for polling and stale Conduit message rejection."""

    stages: tuple[StageState[Any], ...]
    """State for every available stage, in canonical STAGE_DEFINITIONS order."""

    run_status: RunStatus = RunStatus.ACTIVE
    """Lifecycle state of the complete onboarding run."""

    schema_version: int = SCHEMA_VERSION
    """Version of the Redis and public snapshot representation."""

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> OnboardingRun:
        try:
            persisted = PersistedOnboardingRun.parse_obj(value)
            persisted_stages = []
            for item in persisted.stages:
                try:
                    stage = Stage(item.stage)
                except ValueError:
                    # Active runs may still contain stages removed by a deployment.
                    continue

                persisted_stages.append(
                    StageState(
                        stage=stage,
                        status=StageStatus(item.status) if item.status is not None else None,
                        event_note=item.event_note,
                        extra=_deserialize_extra(stage, item.extra),
                    )
                )
            expected_stages = tuple(definition.stage for definition in STAGE_DEFINITIONS)
            persisted_stage_names = tuple(state.stage for state in persisted_stages)
            persisted_stage_indexes = tuple(STAGE_INDEX[stage] for stage in persisted_stage_names)
            if (
                len(set(persisted_stage_names)) != len(persisted_stage_names)
                or tuple(sorted(persisted_stage_indexes)) != persisted_stage_indexes
            ):
                raise InvalidOnboardingRun("Persisted onboarding stages are invalid")
            persisted_stage_by_name = {state.stage: state for state in persisted_stages}
            run_status = RunStatus(persisted.run_status)
            current_stage_index = max(
                (
                    STAGE_INDEX[state.stage]
                    for state in persisted_stages
                    if state.status is not None
                ),
                default=-1,
            )

            # Runs created before a stage was introduced have already omitted it when
            # they progressed further, so mark those earlier additions as bypassed.
            stages = tuple(
                persisted_stage_by_name.get(
                    stage,
                    StageState(
                        stage,
                        StageStatus.BYPASSED
                        if run_status is RunStatus.COMPLETED
                        or STAGE_INDEX[stage] < current_stage_index
                        else None,
                    ),
                )
                for stage in expected_stages
            )
            return cls(
                run_id=persisted.run_id,
                channel_id=persisted.channel_id,
                token_hash=persisted.token_hash,
                client_run_id=persisted.client_run_id,
                user_id=persisted.user_id,
                organization_id=persisted.organization_id,
                created_at=persisted.created_at,
                updated_at=persisted.updated_at,
                expires_at=persisted.expires_at,
                sequence=persisted.sequence,
                stages=stages,
                run_status=run_status,
                schema_version=persisted.schema_version,
            )
        except InvalidOnboardingRun:
            raise
        except (TypeError, ValidationError, ValueError) as error:
            raise InvalidOnboardingRun("Persisted onboarding state is invalid") from error

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "channel_id": self.channel_id,
            "token_hash": self.token_hash,
            "client_run_id": self.client_run_id,
            "user_id": self.user_id,
            "organization_id": self.organization_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "sequence": self.sequence,
            "stages": [
                {
                    "stage": state.stage.value,
                    "status": state.status.value if state.status is not None else None,
                    "event_note": state.event_note,
                    "extra": state.extra.dict() if state.extra is not None else None,
                }
                for state in self.stages
            ],
            "run_status": self.run_status.value,
            "schema_version": self.schema_version,
        }


def initial_stages() -> tuple[StageState[Any], ...]:
    return tuple(StageState(stage=definition.stage) for definition in STAGE_DEFINITIONS)


def _deserialize_extra(stage: Stage, value: object) -> StageExtra | None:
    return get_stage_definition(stage).deserialize_extra(value)


def _validate_text(
    value: str | None, *, field: ProgressUpdateField, name: str, maximum: int
) -> None:
    if value is None:
        return
    if not value or len(value) > maximum:
        raise InvalidProgressUpdate(field, f"{name} must be between 1 and {maximum} characters")
    if any(ord(character) < 32 for character in value):
        raise InvalidProgressUpdate(field, f"{name} cannot contain control characters")


def validate_update(update: ProgressUpdate[Any]) -> None:
    definition = get_stage_definition(update.stage)
    definition.extra_for_update(update)
    _validate_text(
        update.event_note,
        field=ProgressUpdateField.EVENT_NOTE,
        name="Event note",
        maximum=MAX_EVENT_NOTE_LENGTH,
    )
    if update.status is StageStatus.FAILED and update.event_note is None:
        raise InvalidProgressUpdate(
            ProgressUpdateField.EVENT_NOTE, "Failed stages require an event note"
        )
    if update.status is StageStatus.SKIPPED and not definition.optional:
        raise InvalidProgressUpdate(
            ProgressUpdateField.STATUS, "Only optional stages may be skipped"
        )
    if update.status is StageStatus.BYPASSED:
        raise InvalidProgressUpdate(
            ProgressUpdateField.STATUS, "Bypassed stages are inferred by the backend"
        )
    if update.run_status not in {None, RunStatus.COMPLETED, RunStatus.FAILED}:
        raise InvalidProgressUpdate(
            ProgressUpdateField.RUN_STATUS, "Progress updates may only complete or fail a run"
        )
    if update.run_status is RunStatus.COMPLETED and (
        update.stage is not STAGE_DEFINITIONS[-1].stage
        or update.status not in {StageStatus.COMPLETED, StageStatus.SKIPPED}
    ):
        raise InvalidProgressUpdate(
            ProgressUpdateField.RUN_STATUS,
            "Completing a run requires a completed or skipped final stage",
        )
    if update.run_status is RunStatus.FAILED and update.status is not StageStatus.FAILED:
        raise InvalidProgressUpdate(
            ProgressUpdateField.RUN_STATUS, "Failing a run requires a failed stage"
        )


def apply_update(run: OnboardingRun, update: ProgressUpdate[Any], now: datetime) -> OnboardingRun:
    validate_update(update)
    stage_definition = get_stage_definition(update.stage)
    update_extra = stage_definition.extra_for_update(update)
    if now >= run.expires_at:
        raise OnboardingRunExpired("Onboarding run has expired")
    if run.run_status is not RunStatus.ACTIVE:
        if update.run_status is run.run_status:
            return run
        raise OnboardingRunTerminal("Onboarding run is terminal")

    stages = {state.stage: state for state in run.stages}
    current_index = STAGE_INDEX[update.stage]
    for definition in STAGE_DEFINITIONS[:current_index]:
        current = stages[definition.stage]
        if current.status not in {
            StageStatus.COMPLETED,
            StageStatus.SKIPPED,
            StageStatus.BYPASSED,
        }:
            stages[definition.stage] = replace(
                current,
                status=StageStatus.BYPASSED,
                event_note=None,
            )

    current = stages[update.stage]
    frozen_statuses = {
        StageStatus.COMPLETED,
        StageStatus.SKIPPED,
        StageStatus.BYPASSED,
    }
    if current.status in frozen_statuses and update.status is not current.status:
        merged_extra = stage_definition.merge_extra(current.extra, update_extra)
        if merged_extra == current.extra:
            return run

        stages[update.stage] = replace(current, extra=merged_extra)
        return replace(
            run,
            stages=tuple(stages[definition.stage] for definition in STAGE_DEFINITIONS),
            updated_at=now.astimezone(timezone.utc),
            sequence=run.sequence + 1,
        )

    if current.status not in frozen_statuses:
        stages[update.stage] = StageState(
            stage=update.stage,
            status=update.status,
            event_note=update.event_note,
            extra=stage_definition.merge_extra(current.extra, update_extra),
        )
    elif update.event_note and current.event_note is None:
        stages[update.stage] = replace(
            current,
            event_note=update.event_note,
            extra=stage_definition.merge_extra(current.extra, update_extra),
        )
    elif update_extra is not None:
        stages[update.stage] = replace(
            current, extra=stage_definition.merge_extra(current.extra, update_extra)
        )

    candidate = replace(
        run,
        stages=tuple(stages[definition.stage] for definition in STAGE_DEFINITIONS),
        run_status=update.run_status or run.run_status,
    )
    if candidate == run:
        return run

    return replace(
        candidate,
        updated_at=now.astimezone(timezone.utc),
        sequence=run.sequence + 1,
    )
