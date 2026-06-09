from datetime import timedelta

import pytest
from django.utils import timezone

from sentry import options
from sentry.issues.action_log.base import ActionSource, publish_action
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    AutofixPrCreatedAction,
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
from sentry.issues.derived.framework import (
    AggregatorResult,
    Feature,
    Pipeline,
    StateView,
    aggregator,
)
from sentry.issues.derived.groupderiveddata import GroupDerivedData
from sentry.issues.derived.processing import pipeline, process_group_log
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
        self._original_pipeline = processing.pipeline
        processing.pipeline = Pipeline(
            AGGREGATORS, version=processing.pipeline.version, check_mutations=True
        )

    def tearDown(self) -> None:
        processing.pipeline = self._original_pipeline
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

    def test_recent_viewers_tracks_user(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        viewers = derived.data["recent_viewers"]
        assert str(user.id) in viewers

    def test_recent_viewers_multiple_users(self) -> None:
        group = self.create_group()
        user_a = self.user
        user_b = self.create_user()

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user_a.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user_b.id))
        derived = process_group_log(group.id)
        viewers = derived.data["recent_viewers"]
        assert str(user_a.id) in viewers
        assert str(user_b.id) in viewers

    def test_recent_viewers_updates_timestamp(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        viewers = derived.data["recent_viewers"]
        assert len(viewers) == 1
        assert str(user.id) in viewers

    def test_recent_viewers_expires_stale(self) -> None:
        group = self.create_group()
        user_old = self.user
        user_new = self.create_user()
        now = timezone.now()

        GroupActionLogEntry.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            type=0,
            actor_type=GroupActorType.USER,
            actor_id=user_old.id,
            source=SOURCE,
            data={},
            date_added=now - timedelta(days=60),
        )
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user_new.id))

        GroupDerivedData.objects.filter(group_id=group.id).delete()
        derived = process_group_log(group.id)
        viewers = derived.data["recent_viewers"]
        assert str(user_old.id) not in viewers
        assert str(user_new.id) in viewers

    def test_recent_viewers_ignores_no_user(self) -> None:
        group = self.create_group()

        _publish(group=group, action=ViewAction())
        derived = process_group_log(group.id)
        assert derived.data["recent_viewers"] == {}

    # --- working_on ---

    def test_working_on_includes_viewer(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        working = derived.data["working_on"]
        assert str(user.id) in working

    def test_working_on_empty_when_closed(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["working_on"] == {}

    def test_working_on_resets_on_reopen(self) -> None:
        group = self.create_group()
        user_before = self.user
        user_after = self.create_user()

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user_before.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user_before.id))
        _publish(group=group, action=UnresolveAction(), actor=GroupActionActor.user(user_before.id))
        # Only user_after views after reopen
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user_after.id))
        derived = process_group_log(group.id)
        working = derived.data["working_on"]
        assert str(user_after.id) in working
        assert str(user_before.id) not in working

    def test_working_on_since_preserved(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        first_since = derived.data["working_on"][str(user.id)]["since"]

        # Second view shouldn't move "since" forward
        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["working_on"][str(user.id)]["since"] == first_since

    # --- autofix / resolved_in_pull_request ---

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

    def test_autofix_pr_tracked(self) -> None:
        group = self.create_group()

        _publish(
            group=group,
            action=AutofixPrCreatedAction(
                run_id="run-1",
                pull_requests=[
                    {
                        "repo_name": "getsentry/sentry",
                        "pull_request": {"pr_id": 101, "pr_number": 99},
                    }
                ],
            ),
        )
        derived = process_group_log(group.id)
        assert "101" in derived.data["autofix_prs"]

    def test_was_autofixed_when_resolved_by_autofix_pr(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(
            group=group,
            action=AutofixPrCreatedAction(
                run_id="run-1",
                pull_requests=[{"repo_name": "getsentry/sentry", "pull_request": {"pr_id": 101}}],
            ),
        )
        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=GroupActionActor.user(user.id),
        )
        derived = process_group_log(group.id)
        assert derived.data["was_autofixed"] is True

    def test_not_autofixed_when_resolved_by_different_pr(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(
            group=group,
            action=AutofixPrCreatedAction(
                run_id="run-1",
                pull_requests=[{"repo_name": "getsentry/sentry", "pull_request": {"pr_id": 101}}],
            ),
        )
        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=999),
            actor=GroupActionActor.user(user.id),
        )
        derived = process_group_log(group.id)
        assert derived.data["was_autofixed"] is False

    def test_not_autofixed_when_manually_resolved(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(
            group=group,
            action=AutofixPrCreatedAction(
                run_id="run-1",
                pull_requests=[{"repo_name": "getsentry/sentry", "pull_request": {"pr_id": 101}}],
            ),
        )
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["was_autofixed"] is False

    def test_was_autofixed_stays_true_after_reopen(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(
            group=group,
            action=AutofixPrCreatedAction(
                run_id="run-1",
                pull_requests=[{"repo_name": "getsentry/sentry", "pull_request": {"pr_id": 101}}],
            ),
        )
        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=GroupActionActor.user(user.id),
        )
        _publish(group=group, action=UnresolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)
        assert derived.data["was_autofixed"] is True

    def test_not_autofixed_when_already_closed(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(
            group=group,
            action=AutofixPrCreatedAction(
                run_id="run-1",
                pull_requests=[{"repo_name": "getsentry/sentry", "pull_request": {"pr_id": 101}}],
            ),
        )
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        # Issue is already closed; this RESOLVED_IN_PULL_REQUEST is a no-op on status
        _publish(
            group=group,
            action=ResolvedInPullRequestAction(pull_request=101),
            actor=GroupActionActor.user(user.id),
        )
        derived = process_group_log(group.id)
        assert derived.data["was_autofixed"] is False

    def test_query_autofixed_groups(self) -> None:
        """
        Three groups with realistic event streams. All three have autofix PRs
        created. Only group 1 actually gets closed by its autofix PR.
        Verifies the pipeline and ORM query correctly identify just that one.
        """
        user_a = self.user
        user_b = self.create_user()
        groups = [self.create_group() for _ in range(3)]
        autofix_pr_ids = {g.id: 1000 + i for i, g in enumerate(groups)}

        # All three get views and autofix PRs
        for g in groups:
            _publish(group=g, action=ViewAction(), actor=GroupActionActor.user(user_a.id))
            _publish(
                group=g,
                action=AutofixPrCreatedAction(
                    run_id=f"run-{g.id}",
                    pull_requests=[
                        {
                            "repo_name": "getsentry/sentry",
                            "pull_request": {"pr_id": autofix_pr_ids[g.id]},
                        }
                    ],
                ),
            )

        # Group 0: manually resolved (not by autofix PR)
        _publish(group=groups[0], action=ResolveAction(), actor=GroupActionActor.user(user_a.id))

        # Group 1: resolved by its autofix PR
        _publish(
            group=groups[1],
            action=ResolvedInPullRequestAction(pull_request=autofix_pr_ids[groups[1].id]),
            actor=GroupActionActor.user(user_b.id),
        )

        # Group 2: resolved by a different (non-autofix) PR, then reopened
        _publish(
            group=groups[2],
            action=ResolvedInPullRequestAction(pull_request=9999),
            actor=GroupActionActor.user(user_a.id),
        )
        _publish(group=groups[2], action=UnresolveAction(), actor=GroupActionActor.user(user_b.id))

        for g in groups:
            process_group_log(g.id)

        autofixed = list(
            Group.objects.filter(
                groupderiveddata__data__was_autofixed=True,
            ).values_list("id", flat=True)
        )
        assert autofixed == [groups[1].id]


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
        from sentry.issues.derived.fields import STATUS, VIEW_COUNT

        group = self.create_group()
        derived = GroupDerivedData.objects.create(
            group=group,
            data={},
        )
        state = GroupDerivedDataStore.load(pipeline, derived)
        assert state[VIEW_COUNT] == 0
        assert state[STATUS] == "open"

    def test_round_trip_preserves_state(self) -> None:
        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(group=group, action=ResolveAction(), actor=GroupActionActor.user(user.id))
        derived = process_group_log(group.id)

        state = GroupDerivedDataStore.load(pipeline, derived)
        update = GroupDerivedDataStore.build_update(pipeline, state)

        assert update["data"] == derived.data
        assert update["view_count"] == derived.view_count

    def test_round_trip_with_rich_types(self) -> None:
        """Codec-backed features (WorkingOnEntry, frozenset) survive round-trip."""
        from sentry.issues.derived.fields import AUTOFIX_PRS, WORKING_ON

        group = self.create_group()
        user = self.user

        _publish(group=group, action=ViewAction(), actor=GroupActionActor.user(user.id))
        _publish(
            group=group,
            action=AutofixPrCreatedAction(
                run_id="run-1",
                pull_requests=[{"repo_name": "getsentry/sentry", "pull_request": {"pr_id": 101}}],
            ),
        )
        derived = process_group_log(group.id)

        state1 = GroupDerivedDataStore.load(pipeline, derived)
        update = GroupDerivedDataStore.build_update(pipeline, state1)

        # Simulate persisting and reloading.
        GroupDerivedDataStore.apply_to_instance(derived, update)
        state2 = GroupDerivedDataStore.load(pipeline, derived)

        assert state2[WORKING_ON] == state1[WORKING_ON]
        assert state2[AUTOFIX_PRS] == state1[AUTOFIX_PRS]
        assert isinstance(state2[AUTOFIX_PRS], frozenset)
