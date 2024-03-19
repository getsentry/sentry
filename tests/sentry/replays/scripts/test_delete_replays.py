from __future__ import annotations

import datetime
from io import BytesIO
from uuid import uuid4
from zlib import compress

from sentry.models.file import File
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.scripts.delete_replays import delete_replay_ids, delete_replays
from sentry.replays.testutils import (
    mock_replay,
    mock_rrweb_div_helloworld,
    mock_segment_console,
    mock_segment_fullsnapshot,
    mock_segment_init,
    mock_segment_nagivation,
)
from sentry.testutils.cases import ReplaysSnubaTestCase
from sentry.utils.json import dumps_htmlsafe


class TestDeleteReplays(ReplaysSnubaTestCase):
    def store_replay_segments(
        self,
        replay_id: str,
        project_id: int,
        timestamp,
        environment: str | None = None,
        tags: dict | None = None,
    ):
        if tags is None:
            tags = {}

        self.store_replays(
            mock_replay(timestamp, project_id, replay_id, environment=environment, tags=tags)
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

    def assert_replay_deleted(self, replay_id: str):
        replay_recordings = ReplayRecordingSegment.objects.filter(replay_id=replay_id)
        assert len(replay_recordings) == 0

    def assert_replay_not_deleted(self, replay_id: str):
        replay_recordings = ReplayRecordingSegment.objects.filter(replay_id=replay_id)
        assert len(replay_recordings) == 5  # we create 5 segments for each replay in this test

    def setUp(self):
        super().setUp()

        self.other_project = self.create_project(name="some_project")

        self.default_start_time = datetime.datetime.utcnow() - datetime.timedelta(days=89)
        self.default_end_time = datetime.datetime.utcnow() + datetime.timedelta(seconds=5)
        self.small_batch_size = 10

    def test_deletion_replays_basic(self):
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

        delete_replays(
            project_id=self.project.id,
            batch_size=self.small_batch_size,
            environment=[],
            tags=[],
            start_utc=self.default_start_time,
            end_utc=self.default_end_time,
            dry_run=False,
        )

        self.assert_replay_deleted(to_delete)
        self.assert_replay_not_deleted(replay_id_kept_other_project)
        self.assert_replay_not_deleted(replay_id_kept_outside_timerange)

    def test_deletion_replays_dry_run(self):
        not_deleted = uuid4().hex
        self.store_replay_segments(
            not_deleted,
            self.project.id,
            datetime.datetime.now() - datetime.timedelta(seconds=10),
        )
        delete_replays(
            project_id=self.project.id,
            batch_size=self.small_batch_size,
            environment=[],
            tags=[],
            start_utc=self.default_start_time,
            end_utc=self.default_end_time,
            dry_run=True,
        )
        self.assert_replay_not_deleted(not_deleted)

    def test_deletion_replays_env_filter(self):
        replay_with_env = uuid4().hex
        self.store_replay_segments(
            replay_id=replay_with_env,
            project_id=self.project.id,
            timestamp=datetime.datetime.now() - datetime.timedelta(seconds=10),
            environment="myenv",
        )
        delete_replays(
            project_id=self.project.id,
            batch_size=self.small_batch_size,
            environment=["not_env"],
            tags=[],
            start_utc=self.default_start_time,
            end_utc=self.default_end_time,
            dry_run=False,
        )
        self.assert_replay_not_deleted(replay_with_env)

        delete_replays(
            project_id=self.project.id,
            batch_size=self.small_batch_size,
            environment=["myenv"],
            tags=[],
            start_utc=self.default_start_time,
            end_utc=self.default_end_time,
            dry_run=False,
        )
        self.assert_replay_deleted(replay_with_env)

    def test_deletion_replays_tags(self):
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
        delete_replays(
            project_id=self.project.id,
            batch_size=self.small_batch_size,
            tags=["test_tag:notthetag"],
            environment=[],
            start_utc=self.default_start_time,
            end_utc=self.default_end_time,
            dry_run=False,
        )
        self.assert_replay_not_deleted(replay_id_tags)
        self.assert_replay_not_deleted(replay_id_no_tags)

        delete_replays(
            project_id=self.project.id,
            batch_size=self.small_batch_size,
            tags=["tenant:christopher_nolan"],
            environment=[],
            start_utc=self.default_start_time,
            end_utc=self.default_end_time,
            dry_run=False,
        )

        self.assert_replay_deleted(replay_id_tags)
        self.assert_replay_not_deleted(replay_id_no_tags)

    def test_deletion_replays_multitags(self):
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

        delete_replays(
            project_id=self.project.id,
            batch_size=self.small_batch_size,
            tags=["tenant:christopher_nolan", "batman:robin"],
            environment=[],
            start_utc=self.default_start_time,
            end_utc=self.default_end_time,
            dry_run=False,
        )

        self.assert_replay_deleted(replay_id_tags)
        self.assert_replay_not_deleted(replay_id_only_one_tag)
        self.assert_replay_not_deleted(replay_id_two_tags_not_deleted)

    def test_deletion_replays_batch_size_all_deleted(self):
        replay_ids = [uuid4().hex for _ in range(self.small_batch_size + 1)]

        for replay_id in replay_ids:
            self.store_replay_segments(
                replay_id=replay_id,
                project_id=self.project.id,
                timestamp=datetime.datetime.now() - datetime.timedelta(seconds=10),
            )
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

    def test_delete_replays_by_id(self):
        deleted_replay_id = uuid4().hex
        self.store_replay_segments(
            deleted_replay_id,
            self.project.id,
            datetime.datetime.now() - datetime.timedelta(seconds=10),
        )

        kept_replay_id = uuid4().hex
        self.store_replay_segments(
            kept_replay_id,
            self.project.id,
            datetime.datetime.now() - datetime.timedelta(seconds=10),
        )

        delete_replay_ids(project_id=self.project.id, replay_ids=[deleted_replay_id])
        self.assert_replay_deleted(deleted_replay_id)
        self.assert_replay_not_deleted(kept_replay_id)
