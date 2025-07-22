import abc
from abc import abstractmethod
from datetime import timedelta
from unittest import mock
from unittest.mock import Mock

from django.db.models import QuerySet

from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import (
    BaseScheduledDeletion,
    RegionScheduledDeletion,
    ScheduledDeletion,
)
from sentry.deletions.tasks.scheduled import (
    reattempt_deletions,
    reattempt_deletions_control,
    run_scheduled_deletions,
    run_scheduled_deletions_control,
)
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.repository import Repository
from sentry.models.team import Team
from sentry.signals import pending_delete
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.services.user.service import user_service


class RegionalRunScheduleDeletionTest(abc.ABC, TestCase):
    __test__ = Abstract(__module__, __qualname__)

    @property
    @abstractmethod
    def ScheduledDeletion(self) -> type[BaseScheduledDeletion]:
        raise NotImplementedError("Subclasses should implement")

    @abstractmethod
    def create_simple_deletion(self) -> QuerySet:
        raise NotImplementedError("Subclasses should implement!")

    @abstractmethod
    def create_does_not_proceed_deletion(self) -> QuerySet:
        raise NotImplementedError("Subclasses should implement!")

    @abstractmethod
    def run_scheduled_deletions(self) -> None:
        raise NotImplementedError("Subclasses should implement")

    @abstractmethod
    def reattempt_deletions(self) -> None:
        raise NotImplementedError("Subclasses should implement")

    def test_schedule_and_cancel(self):
        qs = self.create_simple_deletion()
        inst = qs.get()

        schedule = self.ScheduledDeletion.schedule(inst, days=0)
        self.ScheduledDeletion.cancel(inst)
        assert not self.ScheduledDeletion.objects.filter(id=schedule.id).exists()

        # No errors if we cancel a delete that wasn't started.
        assert self.ScheduledDeletion.cancel(inst) is None

    def test_duplicate_schedule(self):
        qs = self.create_simple_deletion()
        inst = qs.get()

        first = self.ScheduledDeletion.schedule(inst, days=0)
        second = self.ScheduledDeletion.schedule(inst, days=1)
        # Should get the same record.
        assert first.id == second.id
        assert first.guid == second.guid
        # Date should be updated
        assert second.date_scheduled - first.date_scheduled >= timedelta(days=1)

    def test_simple(self):
        qs = self.create_simple_deletion()
        inst = qs.get()
        schedule = self.ScheduledDeletion.schedule(instance=inst, days=0)

        with self.tasks():
            self.run_scheduled_deletions()

        assert not qs.exists()
        assert not self.ScheduledDeletion.objects.filter(id=schedule.id).exists()

    def test_should_proceed_check(self):
        qs = self.create_does_not_proceed_deletion()
        inst = qs.get()

        schedule = self.ScheduledDeletion.schedule(instance=inst, days=0)

        with self.tasks():
            self.run_scheduled_deletions()

        assert qs.exists()
        assert not self.ScheduledDeletion.objects.filter(id=schedule.id, in_progress=True).exists()

    def test_ignore_in_progress(self):
        qs = self.create_simple_deletion()
        inst = qs.get()
        schedule = self.ScheduledDeletion.schedule(instance=inst, days=0)
        schedule.update(in_progress=True)

        with self.tasks():
            self.run_scheduled_deletions()

        assert qs.exists()
        assert self.ScheduledDeletion.objects.filter(id=schedule.id, in_progress=True).exists()

    def test_future_schedule(self):
        qs = self.create_simple_deletion()
        inst = qs.get()
        schedule = self.ScheduledDeletion.schedule(instance=inst, days=1)

        with self.tasks():
            self.run_scheduled_deletions()

        assert qs.exists()
        assert self.ScheduledDeletion.objects.filter(id=schedule.id, in_progress=False).exists()

    def test_triggers_pending_delete_signal(self):
        signal_handler = Mock()
        pending_delete.connect(signal_handler)

        qs = self.create_simple_deletion()
        inst = qs.get()
        self.ScheduledDeletion.schedule(instance=inst, actor=self.user, days=0)

        with self.tasks():
            self.run_scheduled_deletions()

        assert signal_handler.call_count == 1
        args = signal_handler.call_args_list[0][1]
        assert args["instance"] == inst
        assert args["actor"] == user_service.get_user(user_id=self.user.id)
        pending_delete.disconnect(signal_handler)

    def test_no_pending_delete_trigger_on_skipped_delete(self):
        qs = self.create_does_not_proceed_deletion()
        inst = qs.get()

        signal_handler = Mock()
        pending_delete.connect(signal_handler)

        self.ScheduledDeletion.schedule(instance=inst, actor=self.user, days=0)

        with self.tasks():
            self.run_scheduled_deletions()

        pending_delete.disconnect(signal_handler)
        assert signal_handler.call_count == 0

    def test_handle_missing_record(self):
        qs = self.create_simple_deletion()
        inst = qs.get()
        schedule = self.ScheduledDeletion.schedule(instance=inst, days=0)
        # Delete the inst, the deletion should remove itself, as its work is done.
        inst.delete()

        with self.tasks():
            self.run_scheduled_deletions()

        assert not self.ScheduledDeletion.objects.filter(id=schedule.id).exists()

    def test_reattempt_simple(self):
        qs = self.create_simple_deletion()
        inst = qs.get()
        schedule = self.ScheduledDeletion.schedule(instance=inst, days=-3)
        schedule.update(in_progress=True)
        with self.tasks():
            self.reattempt_deletions()

        schedule.refresh_from_db()
        assert not schedule.in_progress

    def test_reattempt_ignore_recent_jobs(self):
        qs = self.create_simple_deletion()
        inst = qs.get()
        schedule = self.ScheduledDeletion.schedule(instance=inst, days=0)
        schedule.update(in_progress=True)
        with self.tasks():
            self.reattempt_deletions()

        schedule.refresh_from_db()
        assert schedule.in_progress is True

    def test_relocated_model(self):
        qs = self.create_simple_deletion()
        inst = qs.get()

        model_name = type(inst).__name__
        orig_app = inst._meta.app_label
        relocated_models = {("other_app", model_name): (orig_app, model_name)}

        # As if the model was scheduled when it was part of a different app
        with (
            mock.patch.object(inst._meta, "app_label", "other_app"),
            mock.patch.dict("sentry.deletions.RELOCATED_MODELS", relocated_models),
            self.tasks(),
        ):
            schedule = self.ScheduledDeletion.schedule(instance=inst, days=0)
            self.run_scheduled_deletions()

        assert not qs.exists()
        assert not self.ScheduledDeletion.objects.filter(id=schedule.id).exists()

    def test_schedule_bulk_empty_list(self):
        result = self.ScheduledDeletion.schedule_bulk([])
        assert result == []

    def test_schedule_bulk_multiple_items(self):
        qs1 = self.create_simple_deletion()
        inst1 = qs1.get()

        qs2 = self.create_simple_deletion()
        inst2 = qs2.get()

        qs3 = self.create_simple_deletion()
        inst3 = qs3.get()

        instances = [inst1, inst2, inst3]
        schedules = self.ScheduledDeletion.schedule_bulk(instances, days=0)

        assert len(schedules) == 3

        scheduled_ids = {s.object_id for s in schedules}
        expected_ids = {t.id for t in instances}
        assert scheduled_ids == expected_ids

        for schedule in schedules:
            assert self.ScheduledDeletion.objects.filter(id=schedule.id).exists()

    def test_schedule_bulk_duplicate_handling(self):
        """Test that bulk scheduling handles duplicates correctly by updating existing records"""
        qs = self.create_simple_deletion()
        inst = qs.get()

        first = self.ScheduledDeletion.schedule(inst, days=0)
        first_date_scheduled = first.date_scheduled

        schedules = self.ScheduledDeletion.schedule_bulk([inst], days=2, data={"updated": True})

        assert len(schedules) == 1
        updated_schedule = schedules[0]

        updated_schedule.refresh_from_db()

        assert updated_schedule.guid == first.guid
        assert updated_schedule.data == {"updated": True}

        assert updated_schedule.date_scheduled - first_date_scheduled >= timedelta(days=2)


class RunRegionScheduledDeletionTest(RegionalRunScheduleDeletionTest):
    @property
    def ScheduledDeletion(self) -> type[BaseScheduledDeletion]:
        return RegionScheduledDeletion

    def run_scheduled_deletions(self) -> None:
        return run_scheduled_deletions()

    def reattempt_deletions(self) -> None:
        return reattempt_deletions()

    def create_simple_deletion(self) -> QuerySet[Team]:
        org = self.create_organization(name="test")
        team = self.create_team(organization=org, name="delete")

        return Team.objects.filter(id=team.id)

    def create_does_not_proceed_deletion(self) -> QuerySet[Repository]:
        org = self.create_organization(name="test")
        project = self.create_project(organization=org)
        repo = self.create_repo(project=project, name="example/example")
        assert repo.status == ObjectStatus.ACTIVE

        return Repository.objects.filter(id=repo.id)


@control_silo_test
class RunControlScheduledDeletionTest(RegionalRunScheduleDeletionTest):
    @property
    def ScheduledDeletion(self) -> type[BaseScheduledDeletion]:
        return ScheduledDeletion

    def run_scheduled_deletions(self) -> None:
        return run_scheduled_deletions_control()

    def reattempt_deletions(self) -> None:
        return reattempt_deletions_control()

    def create_simple_deletion(self) -> QuerySet[ApiApplication]:
        app = ApiApplication.objects.create(owner_id=self.user.id, allowed_origins="example.com")
        app.status = ApiApplicationStatus.pending_deletion
        app.save()
        return ApiApplication.objects.filter(id=app.id)

    def create_does_not_proceed_deletion(self) -> QuerySet[ApiApplication]:
        app = ApiApplication.objects.create(owner_id=self.user.id, allowed_origins="example.com")
        app.status = ApiApplicationStatus.active
        app.save()
        return ApiApplication.objects.filter(id=app.id)
