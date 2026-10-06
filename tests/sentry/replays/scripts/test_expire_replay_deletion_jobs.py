from __future__ import annotations

import pytest

from sentry.models.project import Project
from sentry.replays.models import DeletionJobStatus, ReplayDeletionJobModel
from sentry.replays.scripts.expire_replay_deletion_jobs import expire_replay_deletion_jobs
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now


class TestExpireReplayDeletionJobs(TestCase):
    def create_job(self, status: str) -> ReplayDeletionJobModel:
        return self.create_replay_deletion_job(
            status=status,
            range_start=before_now(days=7),
            range_end=before_now(days=1),
        )

    def test_expires_pending_in_progress_and_failed(self) -> None:
        pending = self.create_job(DeletionJobStatus.PENDING)
        in_progress = self.create_job(DeletionJobStatus.IN_PROGRESS)
        failed = self.create_job(DeletionJobStatus.FAILED)

        expired = expire_replay_deletion_jobs(
            self.project.id, [pending.id, in_progress.id, failed.id], dry_run=False
        )

        assert sorted(expired) == sorted([pending.id, in_progress.id, failed.id])
        for job in (pending, in_progress, failed):
            job.refresh_from_db()
            assert job.status == DeletionJobStatus.COMPLETED

    def test_already_completed_job_is_untouched(self) -> None:
        job = self.create_job(DeletionJobStatus.COMPLETED)
        date_updated = job.date_updated

        assert expire_replay_deletion_jobs(self.project.id, [job.id], dry_run=False) == []

        job.refresh_from_db()
        assert job.status == DeletionJobStatus.COMPLETED
        assert job.date_updated == date_updated

    def test_unknown_job_id_is_skipped(self) -> None:
        job = self.create_job(DeletionJobStatus.FAILED)

        assert expire_replay_deletion_jobs(self.project.id, [job.id, 1234567], dry_run=False) == [
            job.id
        ]

        job.refresh_from_db()
        assert job.status == DeletionJobStatus.COMPLETED

    def test_unknown_project_id_raises(self) -> None:
        with pytest.raises(Project.DoesNotExist, match="project_id=1234567"):
            expire_replay_deletion_jobs(1234567, [1], dry_run=False)

    def test_dry_run_mutates_nothing(self) -> None:
        job = self.create_job(DeletionJobStatus.IN_PROGRESS)
        date_updated = job.date_updated

        assert expire_replay_deletion_jobs(self.project.id, [job.id], dry_run=True) == [job.id]

        job.refresh_from_db()
        assert job.status == DeletionJobStatus.IN_PROGRESS
        assert job.date_updated == date_updated

    def test_unlisted_jobs_are_untouched(self) -> None:
        expired_job = self.create_job(DeletionJobStatus.FAILED)
        untouched_job = self.create_job(DeletionJobStatus.IN_PROGRESS)

        assert expire_replay_deletion_jobs(self.project.id, [expired_job.id], dry_run=False) == [
            expired_job.id
        ]

        untouched_job.refresh_from_db()
        assert untouched_job.status == DeletionJobStatus.IN_PROGRESS
