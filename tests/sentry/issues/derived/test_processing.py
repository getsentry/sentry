from datetime import datetime, timedelta, timezone

import pytest
from django.db import router, transaction

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.issues.action_log.publish import publish_action
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    ActionSource,
    GroupAction,
    GroupActionActor,
    GroupActionType,
    GroupActorType,
    PullRequestClosedAction,
    ResolveAction,
    ResolvedInPullRequestAction,
    RootCauseIdentifiedAction,
    UnresolveAction,
    ViewAction,
)
from sentry.issues.derived import processing
from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.features import (
    LAST_PROGRESSED_AT,
    PROGRESS,
    STATUS,
    VIEW_COUNT,
    IssueStatus,
)
from sentry.issues.derived.framework import (
    AggregatorResult,
    DateTimeCodec,
    EnumCodec,
    Feature,
    OptionalCodec,
    Pipeline,
    State,
    StateUpdate,
    StateView,
    aggregator,
)
from sentry.issues.derived.processing import (
    PIPELINE,
    GroupLogTimeout,
    invalidate_group_derived_data,
    process_group_log,
)
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.issues.progress_state import IssueProgressState
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.utils import json

SOURCE = ActionSource.API


def _publish(*, group: Group, action: GroupAction, actor: GroupActionActor = SYSTEM_ACTOR) -> None:
    with outbox_runner():
        publish_action(
            action,
            source=SOURCE,
            group_id=group.id,
            project=group.project,
            actor=actor,
        )


@with_feature("projects:issue-action-log-write-to-db")
class ProcessGroupLogTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        # Enable mutation checking so aggregators that modify state in place fail.
        self._original_pipeline = processing.PIPELINE
        processing.PIPELINE = Pipeline(AGGREGATORS, check_mutations=True)

    def tearDown(self) -> None:
        processing.PIPELINE = self._original_pipeline
        super().tearDown()

    def test_records_and_processes(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))

        entries = list(GroupActionLogEntry.objects.filter(group_id=group.id).order_by("id"))
        assert len(entries) == 3
        assert entries[0].type == GroupActionType.VIEW
        assert entries[0].actor_type == GroupActorType.USER
        assert entries[0].actor_id == user.id

        derived = process_group_log(group.id)
        assert derived.cursor_id == entries[-1].id
        assert isinstance(derived.data, dict)

    def test_incremental_processing(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        first_cursor = derived.cursor_id

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.cursor_id > first_cursor

    def test_noop_when_no_new_entries(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        old_updated = derived.date_updated

        derived = process_group_log(group.id)
        assert derived.date_updated == old_updated

    def test_process_group_log_only_affects_target(self) -> None:
        group_a = self.create_group()
        group_b = self.create_group()
        user = self.user

        _publish(group=group_a, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group_b, action=ViewAction(), actor=GroupActionActor.user(user.id))

        cursor_b = GroupDerivedData.objects.get(group_id=group_b.id).cursor_id

        GroupActionLogEntry.objects.create(
            group_id=group_a.id,
            project_id=group_a.project_id,
            type=0,
            actor_type=GroupActorType.SYSTEM,
            actor_id=0,
            source=SOURCE,
            data={},
        )
        process_group_log(group_a.id)

        assert GroupDerivedData.objects.get(group_id=group_b.id).cursor_id == cursor_b

    def test_batched_processing(self) -> None:
        group = self.create_group()
        user = self.user

        for _ in range(5):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))

        # Process in batches of 2 — should take 3 batches (2+2+1)
        derived = process_group_log(group.id, batch_size=2)

        entries = list(GroupActionLogEntry.objects.filter(group_id=group.id).order_by("id"))
        assert derived.cursor_id == entries[-1].id
        assert len(entries) == 5

    def test_system_action_no_user(self) -> None:
        group = self.create_group()

        _publish(group=group, action=ResolveAction())

        entry = GroupActionLogEntry.objects.get(group_id=group.id)
        assert entry.actor_type == GroupActorType.SYSTEM
        assert entry.actor_id == 0

    def test_status_starts_open(self) -> None:
        group = self.create_group()

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)
        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[STATUS] == IssueStatus.OPEN

    def test_resolve_closes(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["status"] == "closed"

    def test_unresolve_reopens(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=UnresolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["status"] == "open"

    def test_duplicate_resolve_ignored(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["status"] == "closed"

    def test_duplicate_unresolve_ignored(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=UnresolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[STATUS] == IssueStatus.OPEN

    def test_status_toggle(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=UnresolveAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["status"] == "closed"

    # --- invalidation ---

    def test_invalidate_deletes_row(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        process_group_log(group.id)
        assert GroupDerivedData.objects.filter(group_id=group.id).exists()

        invalidate_group_derived_data(group.id)
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()

    def test_invalidate_with_cursor_deletes_if_past(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)

        # Cursor at the processed entry — row should be deleted.
        invalidate_group_derived_data(group.id, cursor=(derived.cursor_date, derived.cursor_id))
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()

    def test_invalidate_with_cursor_noop_if_not_reached(self) -> None:
        group = self.create_group()
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        derived = process_group_log(group.id)
        old_cursor = derived.cursor_id

        # Cursor beyond what we've processed — row should be untouched.
        future = derived.cursor_date.replace(year=derived.cursor_date.year + 1)
        invalidate_group_derived_data(group.id, cursor=(future, old_cursor + 1000))
        derived.refresh_from_db()
        assert derived.cursor_id == old_cursor

    def test_invalidate_then_reprocess(self) -> None:
        group = self.create_group()
        user = self.user
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.view_count == 2

        invalidate_group_derived_data(group.id)
        derived = process_group_log(group.id)
        assert derived.view_count == 2  # rebuilt from scratch

    def test_resolved_in_pull_request_proposes_fix(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=GroupActionActor.user(user.id),
        )
        derived = process_group_log(group.id)
        # An open PR referencing the issue proposes a fix; the issue stays open.
        assert derived.data["status"] == "open"
        assert derived.progress == IssueProgressState.FIX_PROPOSED.value

    def test_pull_request_close_demotes_progress(self) -> None:
        group = self.create_group()
        actor = GroupActionActor.user(self.user.id)

        _publish(group=group, action=RootCauseIdentifiedAction(), actor=actor)
        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=actor,
        )
        derived = process_group_log(group.id)
        assert derived.progress == IssueProgressState.FIX_PROPOSED.value

        _publish(
            group=group,
            action=PullRequestClosedAction(pull_request=101, has_other_open_prs=False),
            actor=actor,
        )
        derived = process_group_log(group.id)
        assert derived.progress == IssueProgressState.DIAGNOSED.value

    def test_pull_request_close_with_remaining_keeps_progress(self) -> None:
        group = self.create_group()
        actor = GroupActionActor.user(self.user.id)

        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=actor,
        )
        _publish(
            group=group,
            action=PullRequestClosedAction(pull_request=101, has_other_open_prs=True),
            actor=actor,
        )
        derived = process_group_log(group.id)
        assert derived.progress == IssueProgressState.FIX_PROPOSED.value

    def test_pull_request_close_invalidate_and_replay_matches(self) -> None:
        group = self.create_group()
        actor = GroupActionActor.user(self.user.id)

        _publish(group=group, action=RootCauseIdentifiedAction(), actor=actor)
        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=actor,
        )
        _publish(
            group=group,
            action=PullRequestClosedAction(pull_request=101, has_other_open_prs=False),
            actor=actor,
        )
        first = process_group_log(group.id)
        first_data = first.data.copy()
        first_progress = first.progress
        first_last_progressed_at = first.last_progressed_at

        invalidate_group_derived_data(group.id)
        second = process_group_log(group.id)

        assert second.data == first_data
        assert second.progress == first_progress
        assert second.last_progressed_at == first_last_progressed_at
        assert second.progress == IssueProgressState.DIAGNOSED.value


# --- Pure Python tests (no DB) ---


def test_mutation_checking_catches_in_place_mutation() -> None:
    ITEMS = Feature[list[str]]("items", default_factory=list)

    @aggregator((ITEMS,))
    def bad_mutator(state: StateView, entry: object) -> AggregatorResult:
        state[ITEMS].append("oops")
        return None

    p = Pipeline([bad_mutator], check_mutations=True)
    state = p.initial_state()

    class FakeEntry:
        type = 0

    with pytest.raises(RuntimeError, match="mutated feature 'items' in place"):
        p.step(state, FakeEntry())


def test_state_updated_tracks_merged_features() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)
    state = State({A: 0, B: 0})

    assert state.updated == frozenset()

    state.merge(StateUpdate({A: 1}))
    assert state.updated == frozenset({A})
    assert state[A] == 1
    assert state[B] == 0


def test_build_update_json_blob_includes_all_json_features() -> None:
    A = Feature[int]("a", default=0)
    B = Feature[int]("b", default=0)

    @aggregator((A, B))
    def compute(state: StateView, entry: object) -> AggregatorResult:
        return None

    pipeline = Pipeline([compute])
    state = pipeline.initial_state()

    # Update only A — blob should still contain both A and B
    state.merge(StateUpdate({A: 1}))
    update = GroupDerivedDataStore.build_update(pipeline, state)

    assert update["data"] == {"a": 1, "b": 0}


def test_store_apply_to_instance() -> None:
    derived = GroupDerivedData()
    derived.data = {}
    update = {"data": {"status": "closed"}, "view_count": 5}
    GroupDerivedDataStore.apply_to_instance(derived, update)
    assert derived.data == {"status": "closed"}
    assert derived.view_count == 5


def test_all_feature_defaults_round_trip_through_json() -> None:
    state = PIPELINE.initial_state()
    blob = {f.name: f.to_json(state[f]) for f in PIPELINE.features}
    serialized = json.loads(json.dumps(blob))
    for f in PIPELINE.features:
        assert f.from_json(serialized[f.name]) == state[f], f"round-trip failed for {f.name}"


# --- Codec tests ---


class TestDateTimeCodec:
    def test_json_round_trip(self) -> None:
        codec = DateTimeCodec()
        dt = datetime(2025, 3, 15, 12, 30, 45, tzinfo=timezone.utc)
        assert codec.from_json(codec.to_json(dt)) == dt

    def test_to_json_produces_iso_string(self) -> None:
        codec = DateTimeCodec()
        dt = datetime(2025, 3, 15, 12, 30, 45, tzinfo=timezone.utc)
        dumped = codec.to_json(dt)
        assert isinstance(dumped, str)
        assert dumped == dt.isoformat()

    def test_column_round_trip_is_identity(self) -> None:
        codec = DateTimeCodec()
        dt = datetime(2025, 3, 15, 12, 30, 45, tzinfo=timezone.utc)
        assert codec.from_column(codec.to_column(dt)) == dt
        assert codec.to_column(dt) is dt

    def test_optional_none(self) -> None:
        codec = OptionalCodec(DateTimeCodec())
        assert codec.to_json(None) is None
        assert codec.from_json(None) is None

    def test_optional_json_round_trip(self) -> None:
        codec = OptionalCodec(DateTimeCodec())
        dt = datetime(2025, 3, 15, 12, 30, 45, tzinfo=timezone.utc)
        assert codec.from_json(codec.to_json(dt)) == dt


class TestEnumCodecCoverage:
    @pytest.mark.parametrize("raw", ["open", "closed"])
    def test_issue_status_json_round_trip(self, raw: str) -> None:
        codec = EnumCodec(IssueStatus)
        loaded = codec.from_json(raw)
        assert codec.to_json(loaded) == raw

    @pytest.mark.parametrize("raw", ["open", "closed"])
    def test_issue_status_column_round_trip(self, raw: str) -> None:
        codec = EnumCodec(IssueStatus)
        loaded = codec.from_column(raw)
        assert isinstance(loaded, IssueStatus)
        assert codec.to_column(loaded) == raw

    @pytest.mark.parametrize(
        "raw", ["identified", "assigned", "diagnosed", "fix_proposed", "fix_applied"]
    )
    def test_issue_progress_state_json_round_trip(self, raw: str) -> None:
        codec = EnumCodec(IssueProgressState)
        loaded = codec.from_json(raw)
        assert codec.to_json(loaded) == raw

    @pytest.mark.parametrize(
        "raw", ["identified", "assigned", "diagnosed", "fix_proposed", "fix_applied"]
    )
    def test_issue_progress_state_column_produces_enum(self, raw: str) -> None:
        codec = EnumCodec(IssueProgressState)
        loaded = codec.from_column(raw)
        assert isinstance(loaded, IssueProgressState)

    @pytest.mark.parametrize(
        "raw",
        [None, "identified", "assigned", "diagnosed", "fix_proposed", "fix_applied"],
    )
    def test_optional_progress_json_round_trip(self, raw: str | None) -> None:
        codec = OptionalCodec(EnumCodec(IssueProgressState))
        loaded = codec.from_json(raw)
        assert codec.to_json(loaded) == raw

    @pytest.mark.parametrize(
        "raw",
        [None, "identified", "assigned", "diagnosed", "fix_proposed", "fix_applied"],
    )
    def test_optional_progress_column_round_trip(self, raw: str | None) -> None:
        codec = OptionalCodec(EnumCodec(IssueProgressState))
        loaded = codec.from_column(raw)
        if raw is not None:
            assert isinstance(loaded, IssueProgressState)
        assert codec.to_column(loaded) == raw


# --- Store tests (need DB) ---


@with_feature("projects:issue-action-log-write-to-db")
class GroupDerivedDataStoreTest(TestCase):
    def test_feature_default_matches_column_default(self) -> None:
        field = GroupDerivedData._meta.get_field("progress")
        assert PROGRESS.initial_value() == field.default

    def test_load_returns_defaults_for_empty_data(self) -> None:
        group = self.create_group()
        derived = GroupDerivedData.objects.create(
            group=group,
            data={},
        )
        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[VIEW_COUNT] == 0
        assert state[STATUS] == IssueStatus.OPEN

    def test_load_populates_columns_and_json(self) -> None:
        group = self.create_group()
        derived = GroupDerivedData.objects.create(
            group=group,
            view_count=3,
            progress="diagnosed",
            data={"status": "closed"},
        )
        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[VIEW_COUNT] == 3
        assert state[PROGRESS] == IssueProgressState.DIAGNOSED
        assert isinstance(state[PROGRESS], IssueProgressState)
        assert state[STATUS] == IssueStatus.CLOSED

    def test_load_null_progress(self) -> None:
        group = self.create_group()
        derived = GroupDerivedData.objects.create(
            group=group,
            progress=None,
            data={},
        )
        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[PROGRESS] is None

    def test_round_trip_preserves_state(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        first = process_group_log(group.id)

        first_data = first.data.copy()
        first_view_count = first.view_count
        first_progress = first.progress
        first_last_progressed_at = first.last_progressed_at

        invalidate_group_derived_data(group.id)
        second = process_group_log(group.id)

        assert second.data == first_data
        assert second.view_count == first_view_count
        assert second.progress == first_progress
        assert second.last_progressed_at == first_last_progressed_at

    def test_build_update_only_includes_updated_features(self) -> None:
        state = PIPELINE.initial_state()

        # Update only STATUS (lives in JSON) — column features stay clean
        state.merge(StateUpdate({STATUS: IssueStatus.CLOSED}))

        update = GroupDerivedDataStore.build_update(PIPELINE, state)

        assert "view_count" not in update
        assert "progress" not in update
        assert "last_progressed_at" not in update
        assert "data" in update
        assert update["data"]["status"] == "closed"

        # Update a column-mapped feature — it should appear in the update
        state.merge(StateUpdate({VIEW_COUNT: 5}))
        update = GroupDerivedDataStore.build_update(PIPELINE, state)
        assert update["view_count"] == 5

    def test_build_update_excludes_json_blob_when_no_json_features_updated(self) -> None:
        state = PIPELINE.initial_state()

        # Update only a column-mapped feature — JSON blob should be excluded
        state.merge(StateUpdate({VIEW_COUNT: 3}))

        update = GroupDerivedDataStore.build_update(PIPELINE, state)

        assert update["view_count"] == 3
        assert "data" not in update

    def test_progress_round_trip(self) -> None:
        group = self.create_group()
        user = self.user
        actor = GroupActionActor.user(user.id)

        _publish(group=group, action=ViewAction(), actor=actor)
        derived = process_group_log(group.id)

        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[PROGRESS] == IssueProgressState.IDENTIFIED
        assert state[LAST_PROGRESSED_AT] is None

        _publish(group=group, action=ResolveAction(), actor=actor)
        derived = process_group_log(group.id)

        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[PROGRESS] is None
        assert state[LAST_PROGRESSED_AT] is not None

        _publish(group=group, action=UnresolveAction(), actor=actor)
        derived = process_group_log(group.id)

        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[PROGRESS] == IssueProgressState.IDENTIFIED
        assert state[LAST_PROGRESSED_AT] is not None


class _IntentionalRollback(Exception):
    pass


@with_feature("projects:issue-action-log-write-to-db")
class DerivedDataTransactionTest(TestCase):
    """Verify derived data processing respects transaction boundaries."""

    def test_rolled_back_action_does_not_produce_derived_data(self) -> None:
        group = self.create_group()

        try:
            with transaction.atomic(using=router.db_for_write(CellOutbox)):
                publish_action(
                    ViewAction(),
                    source=SOURCE,
                    group_id=group.id,
                    project=group.project,
                    actor=GroupActionActor.user(self.user.id),
                )
                assert CellOutbox.objects.filter(
                    category=OutboxCategory.GROUP_ACTION_LOG_EVENT
                ).exists()
                raise _IntentionalRollback
        except _IntentionalRollback:
            pass

        assert not CellOutbox.objects.filter(
            category=OutboxCategory.GROUP_ACTION_LOG_EVENT
        ).exists()
        assert GroupActionLogEntry.objects.filter(group_id=group.id).count() == 0
        assert not GroupDerivedData.objects.filter(group_id=group.id).exists()

    def test_committed_action_produces_derived_data(self) -> None:
        group = self.create_group()

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))

        assert GroupActionLogEntry.objects.filter(group_id=group.id).count() == 1
        assert GroupDerivedData.objects.filter(group_id=group.id).exists()
        derived = GroupDerivedData.objects.get(group_id=group.id)
        assert derived.view_count == 1


@with_feature("projects:issue-action-log-write-to-db")
class ProcessGroupLogTimeoutTest(TestCase):
    def test_raises_when_timeout_exceeded(self) -> None:
        group = self.create_group()
        for _ in range(5):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        GroupDerivedData.objects.filter(group_id=group.id).delete()

        with pytest.raises(GroupLogTimeout):
            process_group_log(group.id, batch_size=1, timeout=timedelta(0))

    def test_completes_with_generous_timeout(self) -> None:
        group = self.create_group()
        for _ in range(3):
            _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(self.user.id))
        GroupDerivedData.objects.filter(group_id=group.id).delete()

        derived = process_group_log(group.id, timeout=timedelta(minutes=5))
        assert derived.view_count == 3
