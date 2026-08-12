from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

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


@dataclass(frozen=True)
class StageDefinition:
    """Static behavior for a stage in the ordered onboarding flow."""

    stage: Stage
    """Stage represented by this definition."""

    optional: bool = False
    """Whether later progress may leave this stage without a terminal status."""


# Tuple order is the onboarding order and therefore part of the persisted schema.
STAGE_DEFINITIONS: tuple[StageDefinition, ...] = (
    StageDefinition(Stage.CONNECT_MCP),
    StageDefinition(Stage.ANALYZE_PROJECT),
    StageDefinition(Stage.CREATE_PROJECT),
    StageDefinition(Stage.INSTRUMENT_APP),
    StageDefinition(Stage.PLAN_TEST_ERROR),
    StageDefinition(Stage.SEND_VERIFICATION_ERROR),
    StageDefinition(Stage.RECEIVE_VERIFICATION_ERROR),
    StageDefinition(Stage.PREPARE_PRODUCTION),
    StageDefinition(Stage.CHECK_STACK_TRACE_QUALITY, optional=True),
)

STAGE_DEFINITION_BY_STAGE = {definition.stage: definition for definition in STAGE_DEFINITIONS}
STAGE_INDEX = {definition.stage: index for index, definition in enumerate(STAGE_DEFINITIONS)}


class InvalidOnboardingRun(ValueError):
    """Persisted onboarding state does not match the current schema."""


class ProgressUpdateField(StrEnum):
    """Input field responsible for an invalid progress update."""

    EVENT_NOTE = "event_note"
    STATUS = "status"
    PROJECT_SLUGS = "project_slugs"
    ISSUE_IDS = "issue_ids"
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
class StageState:
    """Persisted UI state for one onboarding stage."""

    stage: Stage
    """Stage represented by this state."""

    status: StageStatus | None = None
    """Latest status, or None before the stage begins."""

    event_note: str | None = None
    """Short user-visible context for the latest update."""


@dataclass(frozen=True)
class ProgressUpdate:
    """Validated state transition reported by the onboarding tool."""

    stage: Stage
    """Stage whose state is changing."""

    status: StageStatus
    """New state for the stage."""

    event_note: str | None = None
    """Optional user-visible context for the update."""

    project_slugs: tuple[str, ...] = ()
    """Validated projects selected during the create-project stage."""

    issue_ids: tuple[str, ...] = ()
    """Validated issues received during the receive-verification-error stage."""

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

    stages: tuple[StageState, ...]
    """State for every available stage, in canonical STAGE_DEFINITIONS order."""

    run_status: RunStatus = RunStatus.ACTIVE
    """Lifecycle state of the complete onboarding run."""

    project_slugs: tuple[str, ...] = ()
    """Validated Sentry projects selected for instrumentation."""

    issue_ids: tuple[str, ...] = ()
    """Validated Sentry issues proving end-to-end event delivery."""

    schema_version: int = SCHEMA_VERSION
    """Version of the Redis and public snapshot representation."""

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> OnboardingRun:
        try:
            persisted_stages = []
            for item in value["stages"]:
                try:
                    stage = Stage(item["stage"])
                except ValueError:
                    # Active runs may still contain stages removed by a deployment.
                    continue

                persisted_stages.append(
                    StageState(
                        stage=stage,
                        status=(
                            StageStatus(item["status"]) if item["status"] is not None else None
                        ),
                        event_note=item.get("event_note"),
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
            run_status = RunStatus(value.get("run_status", RunStatus.ACTIVE))
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
                run_id=value["run_id"],
                channel_id=value["channel_id"],
                token_hash=value["token_hash"],
                client_run_id=value["client_run_id"],
                user_id=value["user_id"],
                organization_id=value["organization_id"],
                created_at=_deserialize_datetime(value["created_at"]),
                updated_at=_deserialize_datetime(value["updated_at"]),
                expires_at=_deserialize_datetime(value["expires_at"]),
                sequence=value["sequence"],
                stages=stages,
                run_status=run_status,
                project_slugs=tuple(value.get("project_slugs", [])),
                issue_ids=tuple(value.get("issue_ids", [])),
                schema_version=value["schema_version"],
            )
        except InvalidOnboardingRun:
            raise
        except (KeyError, TypeError, ValueError) as error:
            raise InvalidOnboardingRun("Persisted onboarding state is invalid") from error

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["created_at"] = self.created_at.isoformat()
        value["updated_at"] = self.updated_at.isoformat()
        value["expires_at"] = self.expires_at.isoformat()
        return value


def initial_stages() -> tuple[StageState, ...]:
    return tuple(StageState(stage=definition.stage) for definition in STAGE_DEFINITIONS)


def _deserialize_datetime(value: object) -> datetime:
    if not isinstance(value, str):
        raise InvalidOnboardingRun("Persisted onboarding timestamp is invalid")

    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise InvalidOnboardingRun("Persisted onboarding timestamp must include a timezone")

    return parsed


def _validate_text(
    value: str | None, *, field: ProgressUpdateField, name: str, maximum: int
) -> None:
    if value is None:
        return
    if not value or len(value) > maximum:
        raise InvalidProgressUpdate(field, f"{name} must be between 1 and {maximum} characters")
    if any(ord(character) < 32 for character in value):
        raise InvalidProgressUpdate(field, f"{name} cannot contain control characters")


def validate_update(update: ProgressUpdate) -> None:
    definition = STAGE_DEFINITION_BY_STAGE[update.stage]
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
    if update.project_slugs and update.stage is not Stage.CREATE_PROJECT:
        raise InvalidProgressUpdate(
            ProgressUpdateField.PROJECT_SLUGS,
            "Project slugs are only valid for the create-project stage",
        )
    if update.issue_ids and update.stage is not Stage.RECEIVE_VERIFICATION_ERROR:
        raise InvalidProgressUpdate(
            ProgressUpdateField.ISSUE_IDS,
            "Issue IDs are only valid for the receive-verification-error stage",
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


def apply_update(run: OnboardingRun, update: ProgressUpdate, now: datetime) -> OnboardingRun:
    validate_update(update)
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
        project_slugs = tuple(dict.fromkeys((*run.project_slugs, *update.project_slugs)))
        issue_ids = tuple(dict.fromkeys((*run.issue_ids, *update.issue_ids)))
        if project_slugs == run.project_slugs and issue_ids == run.issue_ids:
            return run

        return replace(
            run,
            project_slugs=project_slugs,
            issue_ids=issue_ids,
            updated_at=now.astimezone(timezone.utc),
            sequence=run.sequence + 1,
        )

    if current.status not in frozen_statuses:
        stages[update.stage] = StageState(
            stage=update.stage,
            status=update.status,
            event_note=update.event_note,
        )
    elif update.event_note and current.event_note is None:
        stages[update.stage] = replace(current, event_note=update.event_note)

    candidate = replace(
        run,
        stages=tuple(stages[definition.stage] for definition in STAGE_DEFINITIONS),
        run_status=update.run_status or run.run_status,
        project_slugs=tuple(dict.fromkeys((*run.project_slugs, *update.project_slugs))),
        issue_ids=tuple(dict.fromkeys((*run.issue_ids, *update.issue_ids))),
    )
    if candidate == run:
        return run

    return replace(
        candidate,
        updated_at=now.astimezone(timezone.utc),
        sequence=run.sequence + 1,
    )
