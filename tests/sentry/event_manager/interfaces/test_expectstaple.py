from typing import Any

import pytest

from sentry.event_manager import EventManager, get_event_type, materialize_metadata
from sentry.services import eventstore
from sentry.testutils.pytest.fixtures import InstaSnapshotter
from tests.sentry.event_manager.interfaces import CustomSnapshotter as CustomSnapshotterBase

SnapshotInput = dict[str, Any]
CustomSnapshotter = CustomSnapshotterBase[SnapshotInput]


@pytest.fixture
def make_csp_snapshot(insta_snapshot: InstaSnapshotter) -> CustomSnapshotter:
    def inner(data: SnapshotInput) -> None:
        mgr = EventManager(
            data={
                "expectstaple": data,
                "logentry": {"message": "XXX EXPECTSTAPLE MESSAGE NOT THROUGH RELAY XXX"},
            }
        )
        mgr.normalize()
        event_data = mgr.get_data()
        event_type = get_event_type(event_data)
        event_metadata = event_type.get_metadata(event_data)
        event_data.update(materialize_metadata(event_data, event_type, event_metadata))
        evt = eventstore.backend.create_event(project_id=1, data=event_data)
        expectstaple_interface = evt.interfaces.get("expectstaple")
        assert expectstaple_interface is not None
        insta_snapshot(
            {
                "errors": evt.data.get("errors"),
                "to_json": expectstaple_interface.to_json(),
                "metadata": evt.get_event_metadata(),
                "title": evt.title,
            }
        )

    return inner


interface_json = {
    "date_time": "2014-04-06T13:00:50Z",
    "hostname": "www.example.com",
    "port": 443,
    "response_status": "ERROR_RESPONSE",
    "cert_status": "REVOKED",
    "effective_expiration_date": "2014-05-01T12:40:50Z",
    "served_certificate_chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
    "validated_certificate_chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
}


def test_basic(make_csp_snapshot: CustomSnapshotter) -> None:
    make_csp_snapshot(interface_json)
