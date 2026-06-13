import pytest

from sentry import options
from sentry.issues.action_log.base import ActionSource, publish_action
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    GroupAction,
    GroupActionActor,
    GroupActionType,
    GroupActorType,
    ResolveAction,
    ResolvedInPullRequestAction,
    UnresolveAction,
    ViewAction,
)
from sentry.issues.derived import processing
from sentry.issues.derived.aggregators import AGGREGATORS
from sentry.issues.derived.features import STATUS, VIEW_COUNT
from sentry.issues.derived.framework import (
    AggregatorResult,
    Feature,
    Pipeline,
    StateView,
    aggregator,
)
from sentry.issues.derived.groupderiveddata import GroupDerivedData
from sentry.issues.derived.processing import (
    PIPELINE,
    invalidate_group_derived_data,
    process_group_log,
)
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.groupactionlogentry import GroupActionLogEntry
from sentry.models.group import Group
from sentry.testutils.cases import TestCase

SOURCE = ActionSource.API


def _publish(*, group: Group, action: GroupAction, actor: GroupActionActor = SYSTEM_ACTOR) -> None:
    """Helper to call publish_action() with common defaults."""
    publish_action(
        action,
        source=SOURCE,
        group_id=group.id,
        project_id=group.project_id,
        organization_id=group.project.organization_id,
        actor=actor,
    )


class ProcessGroupLogTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        options.set("issues.action-log.write-to-db", True)
        # Enable mutation checking so aggregators that modify state in place fail.
        self._original_pipeline = processing.PIPELINE
        processing.PIPELINE = Pipeline(
            AGGREGATORS, version=processing.PIPELINE.version, check_mutations=True
        )

    def tearDown(self) -> None:
        processing.PIPELINE = self._original_pipeline
        options.delete("issues.action-log.write-to-db")
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
        assert derived.data["status"] == "open"

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
        assert derived.data["status"] == "open"

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

    def test_resolved_in_pull_request_closes(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=GroupActionActor.user(user.id),
        )
        derived = process_group_log(group.id)
        assert derived.data["status"] == "closed"


# --- Pure Python tests (no DB) ---


def test_mutation_checking_catches_in_place_mutation() -> None:
    ITEMS = Feature[list[str]]("items", default_factory=list)

    @aggregator((ITEMS,))
    def bad_mutator(state: StateView, entry: object) -> AggregatorResult:
        state[ITEMS].append("oops")
        return None

    p = Pipeline([bad_mutator], version=1, check_mutations=True)
    state = p.initial_state()

    class FakeEntry:
        type = 0

    with pytest.raises(RuntimeError, match="mutated feature 'items' in place"):
        p.step(state, FakeEntry())


def test_store_apply_to_instance() -> None:
    derived = GroupDerivedData()
    derived.data = {}
    update = {"data": {"status": "closed"}, "view_count": 5}
    GroupDerivedDataStore.apply_to_instance(derived, update)
    assert derived.data == {"status": "closed"}
    assert derived.view_count == 5


# --- Store tests (need DB) ---


class GroupDerivedDataStoreTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        options.set("issues.action-log.write-to-db", True)

    def tearDown(self) -> None:
        options.delete("issues.action-log.write-to-db")
        super().tearDown()

    def test_load_returns_defaults_for_empty_data(self) -> None:
        group = self.create_group()
        derived = GroupDerivedData.objects.create(
            group=group,
            data={},
        )
        state = GroupDerivedDataStore.load(PIPELINE, derived)
        assert state[VIEW_COUNT] == 0
        assert state[STATUS] == "open"

    def test_round_trip_preserves_state(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)

        state = GroupDerivedDataStore.load(PIPELINE, derived)
        update = GroupDerivedDataStore.build_update(PIPELINE, state)

        assert update["data"] == derived.data
        assert update["view_count"] == derived.view_count
