from __future__ import annotations

import datetime
from io import BytesIO
from unittest.mock import patch
from uuid import uuid4
from zlib import compress

from sentry.models.file import File
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.scripts.delete_replays import delete_replays
from sentry.replays.testutils import (
    mock_replay,
    mock_rrweb_div_helloworld,
    mock_segment_console,
    mock_segment_fullsnapshot,
    mock_segment_init,
    mock_segment_nagivation,
)
from sentry.testutils.cases import ReplaysSnubaTestCase
from sentry.testutils.helpers import TaskRunner
from sentry.utils.json import dumps_htmlsafe


class TestDeleteReplays(ReplaysSnubaTestCase):
    def store_replay_segments(
        self,
        replay_id: str,
        project_id: int,
        timestamp: datetime.datetime,
        environment: str | None = None,
        tags: dict[str, str] | None = None,
    ) -> None:
        if tags is None:
            tags = {}

        self.store_replays(
            mock_replay(
                timestamp, project_id, replay_id, environment=environment, tags=tags, segment_id=5
            )
        )

        segments = [
            mock_segment_init(timestamp),
            mock_segment_fullsnapshot(timestamp, [mock_rrweb_div_helloworld()]),
            mock_segment_console(timestamp),
            mock_segment_nagivation(
                timestamp + datetime.timedelta(seconds=1), hrefFrom="/", hrefTo="/home/"
            ),
            mock_segment_nagivation(
                timestamp + datetime.timedelta(seconds=2),
                hrefFrom="/home/",
                hrefTo="/profile/",
            ),
        ]
        for i, segment in enumerate(segments):
            f = File.objects.create(name="rr:{segment_id}", type="replay.recording")
            f.putfile(BytesIO(compress(dumps_htmlsafe(segment).encode())))
            ReplayRecordingSegment.objects.create(
                replay_id=replay_id,
                project_id=project_id,
                segment_id=i,
                file_id=f.id,
            )

    def assert_recording_deleted(self, replay_id: str) -> None:
        replay_recordings = ReplayRecordingSegment.objects.filter(replay_id=replay_id)
        assert len(replay_recordings) == 0

    def assert_recording_not_deleted(self, replay_id: str) -> None:
        replay_recordings = ReplayRecordingSegment.objects.filter(replay_id=replay_id)
        assert len(replay_recordings) == 5  # we create 5 segments for each replay in this test

    def setUp(self) -> None:
        super().setUp()

        self.other_project = self.create_project(name="some_project")

        self.default_start_time = datetime.datetime.utcnow() - datetime.timedelta(days=89)
        self.default_end_time = datetime.datetime.utcnow() + datetime.timedelta(seconds=5)
        self.small_batch_size = 10

    def test_deletion_replays_basic(self) -> None:
        # store replay to be deleted
        to_delete = uuid4().hex
        self.store_replay_segments(
            to_delete,
            self.project.id,
            datetime.datetime.now() - datetime.timedelta(seconds=10),
        )

        # store replays to be kept
        replay_id_kept_other_project = uuid4().hex
        self.store_replay_segments(
            replay_id_kept_other_project,
            self.other_project.id,
            datetime.datetime.now() - datetime.timedelta(seconds=10),
        )

        replay_id_kept_outside_timerange = uuid4().hex
        self.store_replay_segments(
            replay_id_kept_outside_timerange,
            self.project.id,
            datetime.datetime.now() + datetime.timedelta(seconds=10),
        )

        with TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                environment=[],
                tags=[],
                start_utc=self.default_start_time,
                end_utc=self.default_end_time,
                dry_run=False,
            )

        self.assert_recording_deleted(to_delete)
        self.assert_recording_not_deleted(replay_id_kept_other_project)
        self.assert_recording_not_deleted(replay_id_kept_outside_timerange)

    def test_deletion_replays_dry_run(self) -> None:
        not_deleted = uuid4().hex
        self.store_replay_segments(
            not_deleted,
            self.project.id,
            datetime.datetime.now() - datetime.timedelta(seconds=10),
        )

        with TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                environment=[],
                tags=[],
                start_utc=self.default_start_time,
                end_utc=self.default_end_time,
                dry_run=True,
            )

        self.assert_recording_not_deleted(not_deleted)

    def test_deletion_replays_env_filter(self) -> None:
        replay_with_env = uuid4().hex
        self.store_replay_segments(
            replay_id=replay_with_env,
            project_id=self.project.id,
            timestamp=datetime.datetime.now() - datetime.timedelta(seconds=10),
            environment="myenv",
        )

        with TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                environment=["not_env"],
                tags=[],
                start_utc=self.default_start_time,
                end_utc=self.default_end_time,
                dry_run=False,
            )

        self.assert_recording_not_deleted(replay_with_env)

        with TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                environment=["myenv"],
                tags=[],
                start_utc=self.default_start_time,
                end_utc=self.default_end_time,
                dry_run=False,
            )

        self.assert_recording_deleted(replay_with_env)

    def test_deletion_replays_tags(self) -> None:
        replay_id_no_tags = uuid4().hex
        self.store_replay_segments(
            replay_id=replay_id_no_tags,
            project_id=self.project.id,
            environment=None,
            timestamp=datetime.datetime.now() - datetime.timedelta(seconds=10),
        )
        replay_id_tags = uuid4().hex
        self.store_replay_segments(
            replay_id=replay_id_tags,
            project_id=self.project.id,
            timestamp=datetime.datetime.now() - datetime.timedelta(seconds=10),
            tags={"tenant": "christopher_nolan"},
        )

        with TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                tags=["test_tag:notthetag"],
                environment=[],
                start_utc=self.default_start_time,
                end_utc=self.default_end_time,
                dry_run=False,
            )

        self.assert_recording_not_deleted(replay_id_tags)
        self.assert_recording_not_deleted(replay_id_no_tags)

        with TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                tags=["tenant:christopher_nolan"],
                environment=[],
                start_utc=self.default_start_time,
                end_utc=self.default_end_time,
                dry_run=False,
            )

        self.assert_recording_deleted(replay_id_tags)
        self.assert_recording_not_deleted(replay_id_no_tags)

    def test_deletion_replays_multitags(self) -> None:
        replay_id_tags = uuid4().hex
        self.store_replay_segments(
            replay_id=replay_id_tags,
            project_id=self.project.id,
            timestamp=datetime.datetime.now() - datetime.timedelta(seconds=10),
            tags={"tenant": "christopher_nolan", "batman": "robin", "memento": "time"},
        )

        replay_id_only_one_tag = uuid4().hex
        self.store_replay_segments(
            replay_id=replay_id_only_one_tag,
            project_id=self.project.id,
            timestamp=datetime.datetime.now() - datetime.timedelta(seconds=10),
            tags={"tenant": "christopher_nolan"},
        )

        replay_id_two_tags_not_deleted = uuid4().hex
        self.store_replay_segments(
            replay_id=replay_id_two_tags_not_deleted,
            project_id=self.project.id,
            timestamp=datetime.datetime.now() - datetime.timedelta(seconds=10),
            tags={"batman": "robin", "memento": "time"},
        )

        with TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                tags=["tenant:christopher_nolan", "batman:robin"],
                environment=[],
                start_utc=self.default_start_time,
                end_utc=self.default_end_time,
                dry_run=False,
            )

        self.assert_recording_deleted(replay_id_tags)
        self.assert_recording_not_deleted(replay_id_only_one_tag)
        self.assert_recording_not_deleted(replay_id_two_tags_not_deleted)

    def test_deletion_replays_batch_size_all_deleted(self) -> None:
        replay_ids = [uuid4().hex for _ in range(self.small_batch_size + 1)]

        for replay_id in replay_ids:
            self.store_replay_segments(
                replay_id=replay_id,
                project_id=self.project.id,
                timestamp=datetime.datetime.now() - datetime.timedelta(seconds=10),
            )

        with TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                tags=[],
                start_utc=self.default_start_time,
                end_utc=self.default_end_time,
                dry_run=False,
                environment=[],
            )

        replay_recordings = ReplayRecordingSegment.objects.all()
        assert len(replay_recordings) == 0

    def test_deletion_replays_multi_page_keyset_pagination(self) -> None:
        # Store several full pages worth of deletable replays so the keyset cursor has to walk
        # past multiple pages. This guards the property that seek pagination never skips or
        # double-processes a replay across page boundaries.
        num_pages = 3
        to_delete = [uuid4().hex for _ in range(self.small_batch_size * num_pages + 1)]
        for replay_id in to_delete:
            self.store_replay_segments(
                replay_id=replay_id,
                project_id=self.project.id,
                timestamp=datetime.datetime.now() - datetime.timedelta(seconds=10),
            )

        # Keepers that fall inside the id space but must not be touched: a replay in another
        # project and a replay outside the deletion time range.
        replay_id_other_project = uuid4().hex
        self.store_replay_segments(
            replay_id_other_project,
            self.other_project.id,
            datetime.datetime.now() - datetime.timedelta(seconds=10),
        )
        replay_id_outside_timerange = uuid4().hex
        self.store_replay_segments(
            replay_id_outside_timerange,
            self.project.id,
            datetime.datetime.now() + datetime.timedelta(seconds=10),
        )

        with TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                tags=[],
                start_utc=self.default_start_time,
                end_utc=self.default_end_time,
                dry_run=False,
                environment=[],
            )

        for replay_id in to_delete:
            self.assert_recording_deleted(replay_id)
        self.assert_recording_not_deleted(replay_id_other_project)
        self.assert_recording_not_deleted(replay_id_outside_timerange)

    def test_deletion_replays_multiple_time_windows(self) -> None:
        # Store replays spread across a range wider than the chunk size so the finder has to walk
        # more than one time window. Each must still be deleted.
        old_replay = uuid4().hex
        self.store_replay_segments(
            old_replay,
            self.project.id,
            datetime.datetime.now() - datetime.timedelta(days=20),
        )
        mid_replay = uuid4().hex
        self.store_replay_segments(
            mid_replay,
            self.project.id,
            datetime.datetime.now() - datetime.timedelta(days=10),
        )
        recent_replay = uuid4().hex
        self.store_replay_segments(
            recent_replay,
            self.project.id,
            datetime.datetime.now() - datetime.timedelta(seconds=10),
        )

        # A 3-day chunk over a ~30-day range forces roughly ten windows, so each replay lands in a
        # different window from the others.
        with self.options({"replay.bulk_delete_job.chunk_size_days": 3}), TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                environment=[],
                tags=[],
                start_utc=datetime.datetime.utcnow() - datetime.timedelta(days=30),
                end_utc=self.default_end_time,
                dry_run=False,
            )

        self.assert_recording_deleted(old_replay)
        self.assert_recording_deleted(mid_replay)
        self.assert_recording_deleted(recent_replay)

    @patch("sentry.replays.scripts.delete_replays.delete_seer_replay_data")
    def test_deletion_replays_seer_delete_gated(self, mock_delete_seer: object) -> None:
        to_delete = uuid4().hex
        self.store_replay_segments(
            to_delete,
            self.project.id,
            datetime.datetime.now() - datetime.timedelta(seconds=10),
        )

        # Without the feature flag Seer deletion is not attempted.
        with TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                environment=[],
                tags=[],
                start_utc=self.default_start_time,
                end_utc=self.default_end_time,
                dry_run=False,
            )
        assert mock_delete_seer.call_count == 0  # type: ignore[attr-defined]

        # With the feature flag we call Seer with the canonical dashed replay ids.
        deletable = uuid4().hex
        self.store_replay_segments(
            deletable,
            self.project.id,
            datetime.datetime.now() - datetime.timedelta(seconds=10),
        )
        with self.feature("organizations:replay-ai-summaries"), TaskRunner():
            delete_replays(
                project_id=self.project.id,
                batch_size=self.small_batch_size,
                environment=[],
                tags=[],
                start_utc=self.default_start_time,
                end_utc=self.default_end_time,
                dry_run=False,
            )
        assert mock_delete_seer.call_count >= 1  # type: ignore[attr-defined]
        # The replay ids passed to Seer are canonical dashed UUIDs.
        _, _, passed_ids = mock_delete_seer.call_args[0]  # type: ignore[attr-defined]
        for replay_id in passed_ids:
            assert "-" in replay_id
