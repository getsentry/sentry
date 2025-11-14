from typing import int
import csv
import datetime
import io
import uuid
from unittest.mock import patch

import pytest
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


# This test works and should be deterministic but it flaked in production. I'm not totally sure
# why. This assert failed: `assert store_rows.called`. Two possibilities I can think of:
#
#   1. The mock is somehow flawed.
#   2. The database query is returning nothing.
#
# I'm leaning towards the second option. Is it possible the parallelism of the production test
# suite is emptying the db as I'm trying to read from it? Seems like we'd encounter a lot more
# issues than just this test.
@pytest.mark.skip(reason="Flaked due to 'store_rows' function not being called.")
@django_db_all
@pytest.mark.snuba
@requires_snuba
def test_replay_data_export(default_organization, default_project, replay_store) -> None:  # type: ignore[no-untyped-def]
    replay_id = str(uuid.uuid4())
    t0 = datetime.datetime(year=2025, month=1, day=1)
    replay_store.save(mock_replay(t0, default_project.id, replay_id, segment_id=0))

    # Setting has_replays flag because the export will skip projects it assumes do not have
    # replays.
    default_project.update(flags=F("flags").bitor(getattr(Project.flags, "has_replays")))
    default_project.flags.has_replays = True
    default_project.save()

    with (
        TaskRunner(),
        patch("sentry.replays.data_export.request_create_transfer_job") as create_job,
        patch("sentry.replays.data_export.save_to_storage") as store_rows,
    ):
        export_replay_data(
            organization_id=default_organization.id,
            gcp_project_id="1",
            destination_bucket="destination",
            destination_prefix="destination_prefix/",
            database_rows_per_page=1,
        )
        assert create_job.called
        assert store_rows.called
        assert store_rows.call_count == 1
        assert store_rows.call_args[0][0] == "destination"


@django_db_all
@pytest.mark.snuba
@requires_snuba
def test_replay_data_export_invalid_organization(default_project, replay_store) -> None:  # type: ignore[no-untyped-def]
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
            organization_id=1,
            gcp_project_id="1",
            destination_bucket="destination",
            destination_prefix="destination_prefix/",
            database_rows_per_page=1,
        )
        assert not create_job.called
        assert not store_rows.called


@django_db_all
@pytest.mark.snuba
@requires_snuba
def test_replay_data_export_no_replay_projects(  # type: ignore[no-untyped-def]
    default_organization, default_project, replay_store
) -> None:
    replay_id = str(uuid.uuid4())
    t0 = datetime.datetime.now()
    replay_store.save(mock_replay(t0, default_project.id, replay_id, segment_id=0))

    with (
        TaskRunner(),
        patch("sentry.replays.data_export.request_create_transfer_job") as create_job,
        patch("sentry.replays.data_export.save_to_storage") as store_rows,
    ):
        export_replay_data(
            organization_id=default_organization.id,
            gcp_project_id="1",
            destination_bucket="destination",
            destination_prefix="destination_prefix/",
            database_rows_per_page=1,
        )
        assert not create_job.called
        assert not store_rows.called


@django_db_all
@pytest.mark.snuba
@requires_snuba
def test_replay_data_export_no_replay_data(  # type: ignore[no-untyped-def]
    default_organization, default_project
) -> None:
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
            gcp_project_id="1",
            destination_bucket="destination",
            destination_prefix="destination_prefix/",
            database_rows_per_page=1,
        )

        # Blob data is scheduled for export but there no database rows found so we export nothing.
        assert create_job.called
        assert not store_rows.called


@django_db_all
@pytest.mark.snuba
@requires_snuba
def test_export_replay_row_set_async(replay_store) -> None:  # type: ignore[no-untyped-def]
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

    # Assert the number of runs required to export the database given a set of parameters.
    with TaskRunner():
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                max_rows_to_export=3,
                limit=1,
                num_pages=1,
            )
            assert store_rows.call_count == 3

        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                max_rows_to_export=3,
                limit=1,
                num_pages=3,
            )
            assert store_rows.call_count == 1

        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                max_rows_to_export=3,
                limit=3,
                num_pages=1,
            )
            assert store_rows.call_count == 1

        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                max_rows_to_export=3,
                limit=2,
                num_pages=1,
            )
            assert store_rows.call_count == 2

        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                max_rows_to_export=3,
                limit=2,
                num_pages=2,
            )
            assert store_rows.call_count == 1

    # Assert export has a maximum call depth.
    with TaskRunner():
        # We would have exported three but we hit the max call depth.
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                max_rows_to_export=1,
                limit=1,
                num_pages=1,
            )
            reader = csv.reader(io.StringIO(store_rows.call_args[0][2]))
            assert sum(1 for _ in reader) == 2  # Includes headers.

        # We get more than the max call depth because it was within the bounds of the task.
        with patch("sentry.replays.data_export.save_to_storage") as store_rows:
            export_replay_row_set_async.delay(
                project_id=1,
                start=t0,
                end=t3,
                destination_bucket="test",
                max_rows_to_export=1,
                limit=3,
                num_pages=1,
            )
            reader = csv.reader(io.StringIO(store_rows.call_args[0][2]))
            assert sum(1 for _ in reader) == 4  # Includes headers.


@django_db_all
@pytest.mark.snuba
@requires_snuba
def test_export_replay_project_async(replay_store) -> None:  # type: ignore[no-untyped-def]
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
