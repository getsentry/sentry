from datetime import timedelta
from django.utils import timezone

from sentry.eventstore.processing import event_processing_store
from sentry.models import (
    Group,
    GroupInbox,
    GroupInboxReason,
    GroupOwner,
    GroupOwnerType,
    GroupSnooze,
    GroupStatus,
    ProjectOwnership,
)
from sentry.ownership.grammar import Rule, Matcher, Owner, dump_schema
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.tasks.merge import merge_groups
from sentry.tasks.post_process import post_process_group
from sentry.utils.compat.mock import Mock, patch, ANY


class EventMatcher:
    def __init__(self, expected, group=None):
        self.expected = expected
        self.expected_group = group

    def __eq__(self, other):
        matching_id = other.event_id == self.expected.event_id
        if self.expected_group:
            return (
                matching_id
                and self.expected_group == other.group
                and self.expected_group.id == other.group_id
            )
        return matching_id


class PostProcessGroupTest(TestCase):
    @patch("sentry.rules.processor.RuleProcessor")
    @patch("sentry.tasks.servicehooks.process_service_hook")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    @patch("sentry.signals.event_processed.send_robust")
    def test_issueless(
        self,
        mock_signal,
        mock_process_resource_change_bound,
        mock_process_service_hook,
        mock_processor,
    ):
        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "type": "transaction",
                "timestamp": min_ago,
                "start_timestamp": min_ago,
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
        )

        mock_processor.assert_not_called()  # NOQA
        mock_process_service_hook.assert_not_called()  # NOQA
        mock_process_resource_change_bound.assert_not_called()  # NOQA

        mock_signal.assert_called_once_with(
            sender=ANY, project=self.project, event=EventMatcher(event), primary_hash=None
        )

    @patch("sentry.rules.processor.RuleProcessor")
    def test_no_cache_abort(self, mock_processor):
        event = self.store_event(data={}, project_id=self.project.id)

        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key="total-rubbish",
            group_id=event.group_id,
        )

        assert mock_processor.call_count == 0

    def test_processing_cache_cleared(self):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assert event_processing_store.get(cache_key) is None

    def test_processing_cache_cleared_with_commits(self):
        # Regression test to guard against suspect commit calculations breaking the
        # cache
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        self.create_commit(repo=self.create_repo())
        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assert event_processing_store.get(cache_key) is None

    @patch("sentry.rules.processor.RuleProcessor")
    def test_rule_processor_backwards_compat(self, mock_processor):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            group_id=event.group_id,
            cache_key=cache_key,
        )

        mock_processor.assert_called_once_with(EventMatcher(event), True, False, True, False)
        mock_processor.return_value.apply.assert_called_once_with()

        mock_callback.assert_called_once_with(EventMatcher(event), mock_futures)

    @patch("sentry.rules.processor.RuleProcessor")
    def test_rule_processor(self, mock_processor):
        event = self.store_event(data={"message": "testing"}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        mock_processor.assert_called_once_with(EventMatcher(event), True, False, True, False)
        mock_processor.return_value.apply.assert_called_once_with()

        mock_callback.assert_called_once_with(EventMatcher(event), mock_futures)

    @patch("sentry.rules.processor.RuleProcessor")
    def test_group_refresh(self, mock_processor):
        event = self.store_event(data={"message": "testing"}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        group1 = event.group
        group2 = self.create_group(project=self.project)

        assert event.group_id == group1.id
        assert event.group == group1

        with self.tasks():
            merge_groups([group1.id], group2.id)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        # Ensure that rule processing sees the merged group.
        mock_processor.assert_called_with(
            EventMatcher(event, group=group2), True, False, True, False
        )

    @patch("sentry.signals.issue_unignored.send_robust")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_invalidates_snooze(self, mock_processor, send_robust):
        event = self.store_event(data={"message": "testing"}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        group = event.group
        snooze = GroupSnooze.objects.create(group=group, until=timezone.now() - timedelta(hours=1))

        # Check for has_reappeared=False if is_new=True
        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assert GroupInbox.objects.filter(group=group, reason=GroupInboxReason.NEW.value).exists()
        GroupInbox.objects.filter(group=group).delete()  # Delete so it creates the UNIGNORED entry.

        mock_processor.assert_called_with(EventMatcher(event), True, False, True, False)

        cache_key = write_event_to_cache(event)
        # Check for has_reappeared=True if is_new=False
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        mock_processor.assert_called_with(EventMatcher(event), False, False, True, True)

        assert not GroupSnooze.objects.filter(id=snooze.id).exists()

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED
        assert GroupInbox.objects.filter(
            group=group, reason=GroupInboxReason.UNIGNORED.value
        ).exists()
        assert send_robust.called

    @patch("sentry.rules.processor.RuleProcessor")
    def test_maintains_valid_snooze(self, mock_processor):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)
        group = event.group
        snooze = GroupSnooze.objects.create(group=group, until=timezone.now() + timedelta(hours=1))

        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        mock_processor.assert_called_with(EventMatcher(event), True, False, True, False)

        assert GroupSnooze.objects.filter(id=snooze.id).exists()

    def make_ownership(self, extra_rules=None):
        rules = [
            Rule(Matcher("path", "src/*"), [Owner("user", self.user.email)]),
            Rule(Matcher("path", "tests/*"), [Owner("team", self.team.name)]),
            Rule(Matcher("path", "src/app/*"), [Owner("team", self.team.name)]),
        ]
        if extra_rules:
            rules.extend(extra_rules)

        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema(rules),
            fallthrough=True,
            auto_assignment=True,
        )

    def test_owner_assignment_path_precedence(self):
        self.make_ownership()
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user is None
        assert assignee.team == self.team

        owners = list(GroupOwner.objects.filter(group=event.group))
        assert len(owners) == 2
        assert {(self.user.id, None), (None, self.team.id)} == {
            (o.user_id, o.team_id) for o in owners
        }

    def test_owner_assignment_extra_groups(self):
        extra_user = self.create_user()
        self.create_team_membership(self.team, user=extra_user)
        self.make_ownership(
            [Rule(Matcher("path", "src/app/things/in/*"), [Owner("user", extra_user.email)])],
        )
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/things/in/a/path/example2.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user == extra_user
        assert assignee.team is None

        owners = list(GroupOwner.objects.filter(group=event.group))
        assert len(owners) == 2
        assert set([(extra_user.id, None), (None, self.team.id)]) == {
            (o.user_id, o.team_id) for o in owners
        }

    def test_owner_assignment_existing_owners(self):
        extra_user = self.create_user()
        self.create_team_membership(self.team, user=extra_user)
        self.make_ownership(
            [Rule(Matcher("path", "src/app/things/in/*"), [Owner("user", extra_user.email)])],
        )
        GroupOwner.objects.create(
            group=self.group,
            project=self.project,
            organization=self.organization,
            user=self.user,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
        )
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/things/in/a/path/example2.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user == extra_user
        assert assignee.team is None

        owners = list(GroupOwner.objects.filter(group=event.group))
        assert len(owners) == 2
        assert set([(extra_user.id, None), (None, self.team.id)]) == {
            (o.user_id, o.team_id) for o in owners
        }

    def test_owner_assignment_assign_user(self):
        self.make_ownership()
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user == self.user
        assert assignee.team is None

    def test_owner_assignment_ownership_no_matching_owners(self):
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assert not event.group.assignee_set.exists()

    def test_owner_assignment_existing_assignment(self):
        self.make_ownership()
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        event.group.assignee_set.create(team=self.team, project=self.project)
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user is None
        assert assignee.team == self.team

    def test_owner_assignment_owner_is_gone(self):
        self.make_ownership()
        # Remove the team so the rule match will fail to resolve
        self.team.delete()

        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee is None

    @patch("sentry.tasks.servicehooks.process_service_hook")
    def test_service_hook_fires_on_new_event(self, mock_process_service_hook):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)
        hook = self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.created"],
        )

        with self.feature("projects:servicehooks"):
            post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=cache_key,
                group_id=event.group_id,
            )

        mock_process_service_hook.delay.assert_called_once_with(
            servicehook_id=hook.id, event=EventMatcher(event)
        )

    @patch("sentry.tasks.servicehooks.process_service_hook")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_service_hook_fires_on_alert(self, mock_processor, mock_process_service_hook):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        hook = self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.alert"],
        )

        with self.feature("projects:servicehooks"):
            post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=cache_key,
                group_id=event.group_id,
            )

        mock_process_service_hook.delay.assert_called_once_with(
            servicehook_id=hook.id, event=EventMatcher(event)
        )

    @patch("sentry.tasks.servicehooks.process_service_hook")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_service_hook_does_not_fire_without_alert(
        self, mock_processor, mock_process_service_hook
    ):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        mock_processor.return_value.apply.return_value = []

        self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.alert"],
        )

        with self.feature("projects:servicehooks"):
            post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=cache_key,
                group_id=event.group_id,
            )

        assert not mock_process_service_hook.delay.mock_calls

    @patch("sentry.tasks.servicehooks.process_service_hook")
    def test_service_hook_does_not_fire_without_event(self, mock_process_service_hook):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        self.create_service_hook(
            project=self.project, organization=self.project.organization, actor=self.user, events=[]
        )

        with self.feature("projects:servicehooks"):
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=cache_key,
                group_id=event.group_id,
            )

        assert not mock_process_service_hook.delay.mock_calls

    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_on_new_group(self, delay):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)
        group = event.group
        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        delay.assert_called_once_with(action="created", sender="Group", instance_id=group.id)

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_on_error_events(self, delay):
        event = self.store_event(
            data={
                "message": "Foo bar",
                "exception": {"type": "Foo", "value": "shits on fiah yo"},
                "level": "error",
                "timestamp": iso_format(timezone.now()),
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        cache_key = write_event_to_cache(event)

        self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["error.created"],
        )

        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        delay.assert_called_once_with(
            action="created",
            sender="Error",
            instance_id=event.event_id,
            instance=EventMatcher(event),
        )

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_for_non_errors(self, delay):
        event = self.store_event(
            data={"message": "Foo bar", "level": "info", "timestamp": iso_format(timezone.now())},
            project_id=self.project.id,
            assert_no_errors=False,
        )
        cache_key = write_event_to_cache(event)

        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        assert not delay.called

    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_without_feature_flag(self, delay):
        event = self.store_event(
            data={"message": "Foo bar", "level": "info", "timestamp": iso_format(timezone.now())},
            project_id=self.project.id,
            assert_no_errors=False,
        )
        cache_key = write_event_to_cache(event)

        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        assert not delay.called

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_without_error_created(self, delay):
        event = self.store_event(
            data={
                "message": "Foo bar",
                "level": "error",
                "exception": {"type": "Foo", "value": "shits on fiah yo"},
                "timestamp": iso_format(timezone.now()),
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        cache_key = write_event_to_cache(event)

        self.create_service_hook(
            project=self.project, organization=self.project.organization, actor=self.user, events=[]
        )

        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        assert not delay.called

    @patch("sentry.rules.processor.RuleProcessor")
    def test_group_inbox_regression(self, mock_processor):
        event = self.store_event(data={"message": "testing"}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        group = event.group

        post_process_group(
            is_new=True,
            is_regression=True,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        # assert GroupInbox.objects.filter(group=group, reason=GroupInboxReason.NEW.value).exists()
        # GroupInbox.objects.filter(
        #     group=group
        # ).delete()  # Delete so it creates the .REGRESSION entry.

        mock_processor.assert_called_with(EventMatcher(event), True, True, False, False)

        cache_key = write_event_to_cache(event)
        post_process_group(
            event=None,
            is_new=False,
            is_regression=True,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        mock_processor.assert_called_with(EventMatcher(event), False, True, False, False)

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED
        # assert GroupInbox.objects.filter(
        #     group=group, reason=GroupInboxReason.REGRESSION.value
        # ).exists()

    def test_nodestore_stats(self):
        event = self.store_event(data={"message": "testing"}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        with self.options({"store.nodestore-stats-sample-rate": 1.0}), self.tasks():
            post_process_group(
                is_new=True,
                is_regression=True,
                is_new_group_environment=False,
                cache_key=cache_key,
                group_id=event.group_id,
            )
