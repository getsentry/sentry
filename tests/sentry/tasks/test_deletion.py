from datetime import timedelta
from unittest.mock import Mock
from uuid import uuid4

from sentry import nodestore
from sentry.constants import ObjectStatus
from sentry.eventstore.models import Event
from sentry.models import (
    Group,
    GroupAssignee,
    GroupHash,
    GroupMeta,
    GroupRedirect,
    GroupStatus,
    Repository,
    ScheduledDeletion,
    Team,
)
from sentry.signals import pending_delete
from sentry.tasks.deletion import delete_groups, reattempt_deletions, run_scheduled_deletions
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class RunScheduledDeletionTest(TestCase):
    def test_schedule_and_cancel(self):
        org = self.create_organization(name="test")
        team = self.create_team(organization=org, name="delete")

        schedule = ScheduledDeletion.schedule(team, days=0)
        ScheduledDeletion.cancel(team)
        assert not ScheduledDeletion.objects.filter(id=schedule.id).exists()

        # No errors if we cancel a delete that wasn't started.
        assert ScheduledDeletion.cancel(team) is None

    def test_duplicate_schedule(self):
        org = self.create_organization(name="test")
        team = self.create_team(organization=org, name="delete")

        first = ScheduledDeletion.schedule(team, days=0)
        second = ScheduledDeletion.schedule(team, days=1)
        # Should get the same record.
        assert first.id == second.id
        assert first.guid == second.guid
        # Date should be updated
        assert second.date_scheduled - first.date_scheduled >= timedelta(days=1)

    def test_simple(self):
        org = self.create_organization(name="test")
        team = self.create_team(organization=org, name="delete")
        schedule = ScheduledDeletion.schedule(instance=team, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Team.objects.filter(id=team.id).exists()
        assert not ScheduledDeletion.objects.filter(id=schedule.id).exists()

    def test_should_proceed_check(self):
        org = self.create_organization(name="test")
        project = self.create_project(organization=org)
        repo = self.create_repo(project=project, name="example/example")
        assert repo.status == ObjectStatus.ACTIVE

        schedule = ScheduledDeletion.schedule(instance=repo, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert Repository.objects.filter(id=repo.id).exists()
        assert not ScheduledDeletion.objects.filter(id=schedule.id, in_progress=True).exists()

    def test_ignore_in_progress(self):
        org = self.create_organization(name="test")
        team = self.create_team(organization=org, name="delete")
        schedule = ScheduledDeletion.schedule(instance=team, days=0)
        schedule.update(in_progress=True)

        with self.tasks():
            run_scheduled_deletions()

        assert Team.objects.filter(id=team.id).exists()
        assert ScheduledDeletion.objects.filter(id=schedule.id, in_progress=True).exists()

    def test_future_schedule(self):
        org = self.create_organization(name="test")
        team = self.create_team(organization=org, name="delete")
        schedule = ScheduledDeletion.schedule(instance=team, days=1)

        with self.tasks():
            run_scheduled_deletions()

        assert Team.objects.filter(id=team.id).exists()
        assert ScheduledDeletion.objects.filter(id=schedule.id, in_progress=False).exists()

    def test_triggers_pending_delete_signal(self):
        signal_handler = Mock()
        pending_delete.connect(signal_handler)

        org = self.create_organization(name="test")
        team = self.create_team(organization=org, name="delete")
        ScheduledDeletion.schedule(instance=team, actor=self.user, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert signal_handler.call_count == 1
        args = signal_handler.call_args_list[0][1]
        assert args["instance"] == team
        assert args["actor"] == self.user
        pending_delete.disconnect(signal_handler)

    def test_no_pending_delete_trigger_on_skipped_delete(self):
        org = self.create_organization(name="test")
        project = self.create_project(organization=org)
        repo = self.create_repo(project=project, name="example/example")

        signal_handler = Mock()
        pending_delete.connect(signal_handler)

        ScheduledDeletion.schedule(instance=repo, actor=self.user, days=0)

        with self.tasks():
            run_scheduled_deletions()

        pending_delete.disconnect(signal_handler)
        assert signal_handler.call_count == 0

    def test_handle_missing_record(self):
        org = self.create_organization(name="test")
        team = self.create_team(organization=org, name="delete")
        schedule = ScheduledDeletion.schedule(instance=team, days=0)
        # Delete the team, the deletion should remove itself, as its work is done.
        team.delete()

        with self.tasks():
            run_scheduled_deletions()

        assert not ScheduledDeletion.objects.filter(id=schedule.id).exists()


class ReattemptDeletionsTest(TestCase):
    def test_simple(self):
        org = self.create_organization(name="test")
        team = self.create_team(organization=org, name="delete")
        schedule = ScheduledDeletion.schedule(instance=team, days=-3)
        schedule.update(in_progress=True)
        with self.tasks():
            reattempt_deletions()

        schedule.refresh_from_db()
        assert not schedule.in_progress

    def test_ignore_recent_jobs(self):
        org = self.create_organization(name="test")
        team = self.create_team(organization=org, name="delete")
        schedule = ScheduledDeletion.schedule(instance=team, days=0)
        schedule.update(in_progress=True)
        with self.tasks():
            reattempt_deletions()

        schedule.refresh_from_db()
        assert schedule.in_progress is True


class DeleteGroupTest(TestCase):
    def test_simple(self):
        event_id = "a" * 32
        event_id_2 = "b" * 32
        project = self.create_project()

        node_id = Event.generate_node_id(project.id, event_id)
        node_id_2 = Event.generate_node_id(project.id, event_id_2)

        event = self.store_event(
            data={
                "event_id": event_id,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group1"],
            },
            project_id=project.id,
        )

        self.store_event(
            data={
                "event_id": event_id_2,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group1"],
            },
            project_id=project.id,
        )

        group = event.group
        group.update(status=GroupStatus.PENDING_DELETION)

        GroupAssignee.objects.create(group=group, project=project, user=self.user)
        GroupHash.objects.create(project=project, group=group, hash=uuid4().hex)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        GroupRedirect.objects.create(group_id=group.id, previous_group_id=1)

        assert nodestore.get(node_id)
        assert nodestore.get(node_id_2)

        with self.tasks():
            delete_groups(object_ids=[group.id])

        assert not GroupRedirect.objects.filter(group_id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
        assert not Group.objects.filter(id=group.id).exists()
        assert not nodestore.get(node_id)
        assert not nodestore.get(node_id_2)
