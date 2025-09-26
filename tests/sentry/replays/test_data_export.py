import datetime
import uuid
from unittest.mock import patch

import pytest
import requests
from django.conf import settings
from django.db.models import F

from sentry.models.project import Project
from sentry.replays.data_export import export_replay_data
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
        patch("sentry.replays.data_export.save_to_gcs") as store_rows,
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
