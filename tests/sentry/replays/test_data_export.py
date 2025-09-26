import datetime
import uuid
from unittest.mock import patch

import pytest
import requests
from django.conf import settings
from django.db.models import F

from sentry.models.project import Project
from sentry.replays.data_export import (
    export_replay_data,
    export_replay_project_async,
    export_replay_row_set_async,
)
from sentry.replays.testutils import mock_replay
from sentry.testutils.helpers import TaskRunner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba


class ReplayStore:

    def save(self, data):
        request_url = settings.SENTRY_SNUBA + "/tests/entities/replays/insert"
        response = requests.post(request_url, json=[data])
        assert response.status_code == 200


@pytest.fixture
def replay_store():
    assert requests.post(settings.SENTRY_SNUBA + "/tests/replays/drop").status_code == 200
    return ReplayStore()


@django_db_all
@pytest.mark.snuba
@requires_snuba
def test_replay_data_export(default_organization, default_project, replay_store):
    replay_id = str(uuid.uuid4())
    t0 = datetime.datetime.now()
    replay_store.save(mock_replay(t0, default_project.id, replay_id, segment_id=0))

    # Setting has_replays flag because the export will skip projects it assumes do not have
    # replays.
    default_project.flags.has_replays = True
    default_project.update(flags=F("flags").bitor(getattr(Project.flags, "has_replays")))

    with (
        TaskRunner(),
        patch("sentry.replays.data_export.request_create_transfer_job") as create_job,
        patch("sentry.replays.data_export.save_to_storage") as store_rows,
    ):
        export_replay_data(
            organization_id=default_organization.id,
            gcs_project_id="1",
            destination_bucket="destination",
            database_rows_per_page=1,
        )
        assert create_job.called
        assert store_rows.called
        assert store_rows.call_count == 1
        assert store_rows.call_args[0][0] == "destination"
        assert store_rows.call_args[0][1].startswith("replay-row-data/")
        assert replay_id in store_rows.call_args[0][2]


@django_db_all
@pytest.mark.snuba
@requires_snuba
def test_export_replay_row_set_async(replay_store):
    replay1_id = "030c5419-9e0f-46eb-ae18-bfe5fd0331b5"
    replay2_id = "0dbda2b3-9286-4ecc-a409-aa32b241563d"
    replay3_id = "ff08c103-a9a4-47c0-9c29-73b932c2da34"

    t0 = datetime.datetime.now()
    t1 = t0 + datetime.timedelta(days=1)
    t2 = t0 + datetime.timedelta(days=2)
    t3 = t0 + datetime.timedelta(days=3)

    replay_store.save(mock_replay(t0, 1, replay1_id, segment_id=0))
    replay_store.save(mock_replay(t1, 1, replay2_id, segment_id=0))
    replay_store.save(mock_replay(t2, 1, replay3_id, segment_id=0))

    with TaskRunner():
        # Assert we need three runs to export the row set.
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                limit=1,
                num_pages=1,
            )
            assert store_rows.call_count == 3

        # Assert we need one run to export the row set.
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                limit=1,
                num_pages=3,
            )
            assert store_rows.call_count == 1

        # Assert we need one run to export the row set.
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                limit=3,
                num_pages=1,
            )
            assert store_rows.call_count == 1

        # Assert we need two runs to export the row set.
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                limit=2,
                num_pages=1,
            )
            assert store_rows.call_count == 2

        # Assert we need one run to export the row set.
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                limit=2,
                num_pages=2,
            )
            assert store_rows.call_count == 1


@django_db_all
@pytest.mark.snuba
@requires_snuba
def test_export_replay_project_async(replay_store):
    replay1_id = str(uuid.uuid4())
    replay2_id = str(uuid.uuid4())
    replay3_id = str(uuid.uuid4())
    replay4_id = str(uuid.uuid4())
    replay5_id = str(uuid.uuid4())

    t0 = datetime.datetime.now()
    t1 = t0 + datetime.timedelta(days=1)
    t2 = t0 + datetime.timedelta(days=2)

    replay_store.save(mock_replay(t0, 1, replay1_id, segment_id=0))
    replay_store.save(mock_replay(t0, 1, replay2_id, segment_id=0))
    replay_store.save(mock_replay(t1, 1, replay3_id, segment_id=0))
    replay_store.save(mock_replay(t1, 1, replay4_id, segment_id=0))
    replay_store.save(mock_replay(t2, 1, replay5_id, segment_id=0))

    with TaskRunner():
        # Assert we need five runs to export the row set.
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_project_async.delay(
                project_id=1,
                destination_bucket="test",
                limit=1,
                num_pages=1,
            )
            assert store_rows.call_count == 5

        # Assert we can reduce the run count by modifying the limit.
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_project_async.delay(
                project_id=1,
                destination_bucket="test",
                limit=2,
                num_pages=1,
            )
            assert store_rows.call_count == 3

        # Assert we can reduce the run count by modifying the number of pages per run.
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_project_async.delay(
                project_id=1,
                destination_bucket="test",
                limit=1,
                num_pages=2,
            )
            assert store_rows.call_count == 3

        # Assert we need three runs because date bucketing is the limiting factor.
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_project_async.delay(
                project_id=1,
                destination_bucket="test",
                limit=1000,
                num_pages=1000,
            )
            assert store_rows.call_count == 3
