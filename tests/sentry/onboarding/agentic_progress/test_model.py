from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any, assert_type

import pytest

from sentry.onboarding.agentic_progress.model import (
    STAGE_DEFINITIONS,
    STAGE_INDEX,
    CreateProjectExtra,
    InvalidOnboardingRun,
    InvalidProgressUpdate,
    OnboardingRun,
    OnboardingRunExpired,
    OnboardingRunTerminal,
    ProgressUpdate,
    ProgressUpdateField,
    RunStatus,
    Stage,
    StageDefinition,
    StageState,
    StageStatus,
    VerificationErrorExtra,
    apply_update,
    get_stage_definition,
    initial_stages,
    validate_update,
)


def make_run(now: datetime) -> OnboardingRun:
    return OnboardingRun(
        run_id="run-id",
        channel_id="channel-id",
        token_hash="hash",
        client_run_id="client-id",
        user_id=1,
        organization_id=2,
        created_at=now,
        updated_at=now,
        expires_at=now + timedelta(hours=24),
        sequence=0,
        stages=initial_stages(),
    )


def test_stage_definitions_are_ordered_and_complete() -> None:
    assert [definition.stage for definition in STAGE_DEFINITIONS] == list(Stage)
    assert STAGE_DEFINITIONS[-1].optional is True


def test_extra_stage_definition_preserves_its_type() -> None:
    assert_type(
        get_stage_definition(Stage.CREATE_PROJECT),
        StageDefinition[CreateProjectExtra],
    )
    assert_type(
        get_stage_definition(Stage.RECEIVE_VERIFICATION_ERROR),
        StageDefinition[VerificationErrorExtra],
    )


@pytest.mark.parametrize(
    "stages", [lambda stages: stages + stages[-1:], lambda stages: stages[::-1]]
)
def test_from_dict_rejects_duplicate_or_reordered_stages(stages: Any) -> None:
    value = make_run(datetime(2020, 1, 1, tzinfo=timezone.utc)).to_dict()
    value["stages"] = stages(value["stages"])

    with pytest.raises(InvalidOnboardingRun, match="stages are invalid"):
        OnboardingRun.from_dict(value)


def test_from_dict_bypasses_stages_added_after_run_started() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    run = apply_update(
        make_run(now),
        ProgressUpdate(stage=Stage.PREPARE_PRODUCTION, status=StageStatus.ACTIVE),
        now,
    )
    value = run.to_dict()
    earlier_stage = Stage.CREATE_PROJECT
    later_stage = Stage.CHECK_STACK_TRACE_QUALITY
    value["stages"] = [
        item for item in value["stages"] if item["stage"] not in {earlier_stage, later_stage}
    ]

    restored = OnboardingRun.from_dict(value)

    assert tuple(state.stage for state in restored.stages) == tuple(Stage)
    assert restored.stages[STAGE_INDEX[earlier_stage]] == StageState(
        stage=earlier_stage,
        status=StageStatus.BYPASSED,
    )
    assert restored.stages[STAGE_INDEX[Stage.PREPARE_PRODUCTION]].status is StageStatus.ACTIVE
    assert restored.stages[STAGE_INDEX[later_stage]] == StageState(stage=later_stage)


def test_from_dict_bypasses_trailing_stage_added_after_run_completed() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    run = apply_update(
        make_run(now),
        ProgressUpdate(
            stage=Stage.CHECK_STACK_TRACE_QUALITY,
            status=StageStatus.SKIPPED,
            run_status=RunStatus.COMPLETED,
        ),
        now,
    )
    persisted = run.to_dict()
    persisted["stages"] = persisted["stages"][:-1]

    restored = OnboardingRun.from_dict(persisted)

    assert restored.run_status is RunStatus.COMPLETED
    assert restored.stages[-1] == StageState(
        stage=Stage.CHECK_STACK_TRACE_QUALITY,
        status=StageStatus.BYPASSED,
    )


def test_from_dict_leaves_trailing_stage_pending_after_run_failed() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    run = apply_update(
        make_run(now),
        ProgressUpdate(
            stage=Stage.PREPARE_PRODUCTION,
            status=StageStatus.FAILED,
            event_note="Production preparation failed.",
            run_status=RunStatus.FAILED,
        ),
        now,
    )
    persisted = run.to_dict()
    persisted["stages"] = persisted["stages"][:-1]

    restored = OnboardingRun.from_dict(persisted)

    assert restored.run_status is RunStatus.FAILED
    assert restored.stages[-1] == StageState(stage=Stage.CHECK_STACK_TRACE_QUALITY)


def test_from_dict_ignores_removed_persisted_stages() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    run = apply_update(
        make_run(now),
        ProgressUpdate(stage=Stage.ANALYZE_PROJECT, status=StageStatus.ACTIVE),
        now,
    )
    persisted = run.to_dict()
    persisted_stages = list(persisted["stages"])
    persisted_stages.insert(
        1,
        {
            "stage": "removed_stage",
            "status": "completed",
            "event_note": "This stage no longer exists.",
        },
    )
    persisted["stages"] = persisted_stages

    restored = OnboardingRun.from_dict(persisted)

    assert restored == run


def test_from_dict_wraps_invalid_persisted_stage_status() -> None:
    persisted = make_run(datetime(2020, 1, 1, tzinfo=timezone.utc)).to_dict()
    persisted["stages"][0]["status"] = "unknown_status"

    with pytest.raises(InvalidOnboardingRun, match="state is invalid"):
        OnboardingRun.from_dict(persisted)


def test_from_dict_wraps_invalid_persisted_run_status() -> None:
    persisted = make_run(datetime(2020, 1, 1, tzinfo=timezone.utc)).to_dict()
    persisted["run_status"] = None

    with pytest.raises(InvalidOnboardingRun, match="state is invalid"):
        OnboardingRun.from_dict(persisted)


@pytest.mark.parametrize(
    ("stage", "extra"),
    [
        (Stage.CREATE_PROJECT, {"project_slugs": ["project", 1]}),
        (Stage.CREATE_PROJECT, {"project_slugs": ["project"], "unknown": True}),
        (Stage.CREATE_PROJECT, {"issue_ids": ["123"]}),
        (Stage.CONNECT_MCP, {"project_slugs": ["project"]}),
    ],
)
def test_from_dict_rejects_invalid_stage_extra(stage: Stage, extra: dict[str, object]) -> None:
    persisted = make_run(datetime(2020, 1, 1, tzinfo=timezone.utc)).to_dict()
    persisted["stages"][STAGE_INDEX[stage]]["extra"] = extra

    with pytest.raises(InvalidOnboardingRun, match=f"Invalid extra data for {stage.value}"):
        OnboardingRun.from_dict(persisted)


def test_stage_extra_round_trips() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    run = apply_update(
        make_run(now),
        ProgressUpdate(
            stage=Stage.CREATE_PROJECT,
            status=StageStatus.COMPLETED,
            extra=CreateProjectExtra(project_slugs=("frontend", "backend")),
        ),
        now,
    )

    assert OnboardingRun.from_dict(run.to_dict()) == run


def test_empty_stage_extra_round_trips() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    run = apply_update(
        make_run(now),
        ProgressUpdate(
            stage=Stage.CREATE_PROJECT,
            status=StageStatus.COMPLETED,
            extra=CreateProjectExtra(project_slugs=()),
        ),
        now,
    )

    assert OnboardingRun.from_dict(run.to_dict()) == run


def test_from_dict_rejects_empty_persisted_stage_status() -> None:
    persisted = make_run(datetime(2020, 1, 1, tzinfo=timezone.utc)).to_dict()
    persisted["stages"][0]["status"] = ""

    with pytest.raises(InvalidOnboardingRun, match="state is invalid"):
        OnboardingRun.from_dict(persisted)


def test_later_stage_bypasses_all_earlier_unreported_stages() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    result = apply_update(
        make_run(now),
        ProgressUpdate(stage=Stage.PREPARE_PRODUCTION, status=StageStatus.ACTIVE),
        now,
    )

    states = {state.stage: state.status for state in result.stages}
    assert all(states[stage] is StageStatus.BYPASSED for stage in list(Stage)[:7])
    assert states[Stage.PREPARE_PRODUCTION] is StageStatus.ACTIVE
    assert states[Stage.CHECK_STACK_TRACE_QUALITY] is None


def test_optional_stage_can_be_explicitly_skipped() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    result = apply_update(
        make_run(now),
        ProgressUpdate(
            stage=Stage.CHECK_STACK_TRACE_QUALITY,
            status=StageStatus.SKIPPED,
            run_status=RunStatus.COMPLETED,
        ),
        now,
    )

    assert result.run_status is RunStatus.COMPLETED
    assert result.stages[-1].status is StageStatus.SKIPPED


def test_run_cannot_complete_before_final_stage() -> None:
    with pytest.raises(InvalidProgressUpdate, match="final stage") as error:
        validate_update(
            ProgressUpdate(
                stage=Stage.PREPARE_PRODUCTION,
                status=StageStatus.COMPLETED,
                run_status=RunStatus.COMPLETED,
            )
        )

    assert error.value.field is ProgressUpdateField.RUN_STATUS


def test_completed_stage_never_regresses() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    completed = apply_update(
        make_run(now),
        ProgressUpdate(stage=Stage.CREATE_PROJECT, status=StageStatus.COMPLETED),
        now,
    )
    late = apply_update(
        completed,
        ProgressUpdate(stage=Stage.CREATE_PROJECT, status=StageStatus.ACTIVE),
        now,
    )

    assert late == completed


def test_skipped_stage_never_regresses() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    skipped = apply_update(
        make_run(now),
        ProgressUpdate(
            stage=Stage.CHECK_STACK_TRACE_QUALITY,
            status=StageStatus.SKIPPED,
        ),
        now,
    )
    late = apply_update(
        skipped,
        ProgressUpdate(
            stage=Stage.CHECK_STACK_TRACE_QUALITY,
            status=StageStatus.ACTIVE,
        ),
        now + timedelta(seconds=1),
    )

    assert late == skipped


def test_frozen_stage_rejects_incompatible_run_failure() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    completed = apply_update(
        make_run(now),
        ProgressUpdate(stage=Stage.CREATE_PROJECT, status=StageStatus.COMPLETED),
        now,
    )

    late = apply_update(
        completed,
        ProgressUpdate(
            stage=Stage.CREATE_PROJECT,
            status=StageStatus.FAILED,
            event_note="Project creation failed.",
            run_status=RunStatus.FAILED,
        ),
        now + timedelta(seconds=1),
    )

    assert late == completed


def test_failed_stage_can_be_retried() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    failed = apply_update(
        make_run(now),
        ProgressUpdate(
            stage=Stage.ANALYZE_PROJECT,
            status=StageStatus.FAILED,
            event_note="Could not identify the platform.",
        ),
        now,
    )
    active = apply_update(
        failed,
        ProgressUpdate(stage=Stage.ANALYZE_PROJECT, status=StageStatus.ACTIVE),
        now + timedelta(seconds=1),
    )

    assert active.stages[1].status is StageStatus.ACTIVE


def test_terminal_run_only_accepts_idempotent_replay() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    update: ProgressUpdate[Any] = ProgressUpdate(
        stage=Stage.ANALYZE_PROJECT,
        status=StageStatus.FAILED,
        event_note="Command failed.",
        run_status=RunStatus.FAILED,
    )
    terminal = apply_update(make_run(now), update, now)

    assert apply_update(terminal, update, now) == terminal
    with pytest.raises(OnboardingRunTerminal, match="terminal"):
        apply_update(
            terminal,
            ProgressUpdate(stage=Stage.ANALYZE_PROJECT, status=StageStatus.ACTIVE),
            now,
        )


def test_expired_run_rejects_updates() -> None:
    now = datetime(2020, 1, 2, tzinfo=timezone.utc)
    run = make_run(now - timedelta(days=1))

    with pytest.raises(OnboardingRunExpired, match="expired"):
        apply_update(
            run,
            ProgressUpdate(stage=Stage.CONNECT_MCP, status=StageStatus.COMPLETED),
            now,
        )


def test_only_optional_stage_can_be_skipped() -> None:
    validate_update(
        ProgressUpdate(stage=Stage.CHECK_STACK_TRACE_QUALITY, status=StageStatus.SKIPPED)
    )
    with pytest.raises(ValueError, match="optional"):
        validate_update(ProgressUpdate(stage=Stage.CREATE_PROJECT, status=StageStatus.SKIPPED))


def test_bypassed_status_cannot_be_reported() -> None:
    with pytest.raises(ValueError, match="inferred by the backend"):
        validate_update(ProgressUpdate(stage=Stage.ANALYZE_PROJECT, status=StageStatus.BYPASSED))


def test_bypassed_stage_never_regresses() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    advanced = apply_update(
        make_run(now),
        ProgressUpdate(stage=Stage.CREATE_PROJECT, status=StageStatus.ACTIVE),
        now,
    )

    late = apply_update(
        advanced,
        ProgressUpdate(stage=Stage.ANALYZE_PROJECT, status=StageStatus.COMPLETED),
        now + timedelta(seconds=1),
    )

    assert late == advanced


def test_inferred_bypass_clears_stale_event_note() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    waiting = apply_update(
        make_run(now),
        ProgressUpdate(
            stage=Stage.ANALYZE_PROJECT,
            status=StageStatus.WAITING,
            event_note="Waiting for the platform.",
        ),
        now,
    )

    advanced = apply_update(
        waiting,
        ProgressUpdate(stage=Stage.CREATE_PROJECT, status=StageStatus.ACTIVE),
        now + timedelta(seconds=1),
    )

    assert advanced.stages[1].status is StageStatus.BYPASSED
    assert advanced.stages[1].event_note is None


@pytest.mark.parametrize(
    ("later_stage", "owning_stage", "extra"),
    [
        (
            Stage.INSTRUMENT_APP,
            Stage.CREATE_PROJECT,
            CreateProjectExtra(project_slugs=("example-project",)),
        ),
        (
            Stage.PREPARE_PRODUCTION,
            Stage.RECEIVE_VERIFICATION_ERROR,
            VerificationErrorExtra(issue_ids=("12345",)),
        ),
    ],
)
def test_bypassed_stage_accepts_late_metadata(
    later_stage: Stage,
    owning_stage: Stage,
    extra: CreateProjectExtra | VerificationErrorExtra,
) -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    advanced = apply_update(
        make_run(now),
        ProgressUpdate(stage=later_stage, status=StageStatus.ACTIVE),
        now,
    )

    enriched = apply_update(
        advanced,
        ProgressUpdate(
            stage=owning_stage,
            status=StageStatus.COMPLETED,
            extra=extra,
        ),
        now + timedelta(seconds=1),
    )

    stage = enriched.stages[list(Stage).index(owning_stage)]
    assert stage.status is StageStatus.BYPASSED
    assert stage.extra == extra
    assert enriched.sequence == advanced.sequence + 1


@pytest.mark.parametrize(
    ("update", "message"),
    [
        (
            ProgressUpdate(stage=Stage.ANALYZE_PROJECT, status=StageStatus.FAILED),
            "event note",
        ),
        (
            ProgressUpdate(
                stage=Stage.ANALYZE_PROJECT,
                status=StageStatus.COMPLETED,
                run_status=RunStatus.FAILED,
            ),
            "failed stage",
        ),
    ],
)
def test_update_validation(update: ProgressUpdate[Any], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        validate_update(update)


@pytest.mark.parametrize(
    ("field", "value"),
    [("event_note", "x" * 257), ("event_note", "line\nbreak")],
)
def test_text_validation(field: str, value: str) -> None:
    kwargs: dict[str, Any] = {field: value}
    with pytest.raises(ValueError):
        validate_update(
            ProgressUpdate(stage=Stage.ANALYZE_PROJECT, status=StageStatus.ACTIVE, **kwargs)
        )


def test_expired_run_rejects_update() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    run = replace(make_run(now), expires_at=now)

    with pytest.raises(ValueError, match="expired"):
        apply_update(
            run,
            ProgressUpdate(stage=Stage.CONNECT_MCP, status=StageStatus.COMPLETED),
            now,
        )


def test_verification_extra_is_scoped_to_verification_receipt() -> None:
    extra = VerificationErrorExtra(issue_ids=("123",))
    with pytest.raises(ValueError, match="Extra data"):
        validate_update(
            ProgressUpdate(
                stage=Stage.CREATE_PROJECT,
                status=StageStatus.COMPLETED,
                extra=extra,
            )
        )

    validate_update(
        ProgressUpdate(
            stage=Stage.RECEIVE_VERIFICATION_ERROR,
            status=StageStatus.COMPLETED,
            extra=extra,
        )
    )


def test_project_extra_is_scoped_to_project_creation() -> None:
    extra = CreateProjectExtra(project_slugs=("project-one", "project-two"))
    with pytest.raises(ValueError, match="Extra data"):
        validate_update(
            ProgressUpdate(
                stage=Stage.INSTRUMENT_APP,
                status=StageStatus.COMPLETED,
                extra=extra,
            )
        )

    validate_update(
        ProgressUpdate(
            stage=Stage.CREATE_PROJECT,
            status=StageStatus.COMPLETED,
            extra=extra,
        )
    )


def test_metadata_accumulates_unique_values() -> None:
    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    first = apply_update(
        make_run(now),
        ProgressUpdate(
            stage=Stage.CREATE_PROJECT,
            status=StageStatus.ACTIVE,
            extra=CreateProjectExtra(project_slugs=("frontend", "backend")),
        ),
        now,
    )

    updated = apply_update(
        first,
        ProgressUpdate(
            stage=Stage.CREATE_PROJECT,
            status=StageStatus.COMPLETED,
            extra=CreateProjectExtra(project_slugs=("backend", "worker")),
        ),
        now + timedelta(seconds=1),
    )

    assert updated.stages[STAGE_INDEX[Stage.CREATE_PROJECT]].extra == CreateProjectExtra(
        project_slugs=("frontend", "backend", "worker")
    )


@pytest.mark.parametrize("field", ["created_at", "updated_at", "expires_at"])
def test_from_dict_rejects_invalid_timestamps(field: str) -> None:
    persisted = make_run(datetime(2020, 1, 1, tzinfo=timezone.utc)).to_dict()
    persisted[field] = "2020-01-01T00:00:00"

    with pytest.raises(InvalidOnboardingRun, match="state is invalid"):
        OnboardingRun.from_dict(persisted)


def test_persisted_timestamps_round_trip_as_datetimes() -> None:
    run = make_run(datetime(2020, 1, 1, tzinfo=timezone.utc))

    restored = OnboardingRun.from_dict(run.to_dict())

    assert restored == run
    assert isinstance(restored.created_at, datetime)
