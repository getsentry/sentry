import pytest

from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@pytest.fixture(autouse=True)
def reprocessing_feature(monkeypatch):
    with Feature({"organizations:reprocessing-v2": True}):
        yield


@pytest.fixture(autouse=True)
def auto_login(settings, client, default_user):
    assert client.login(username=default_user.username, password="admin")


@django_db_all
@region_silo_test
def test_simple(client, factories, default_project):
    min_ago = iso_format(before_now(minutes=1))
    event1 = factories.store_event(
        data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=default_project.id
    )

    path = f"/api/0/projects/{event1.project.organization.slug}/{event1.project.slug}/events/{event1.event_id}/reprocessable/"

    response = client.get(path, format="json")
    assert response.status_code == 200
    assert not response.data["reprocessable"]
    assert response.data["reason"] == "unprocessed_event.not_found"
