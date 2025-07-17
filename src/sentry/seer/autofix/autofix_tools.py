import orjson

from sentry import eventstore
from sentry.api.serializers import EventSerializer, serialize
from sentry.profiles.utils import get_from_profiling_service
from sentry.seer.autofix.autofix import _convert_profile_to_execution_tree


def get_profile_details(organization_id: int, project_id: int, profile_id: str):
    response = get_from_profiling_service(
        "GET",
        f"/organizations/{organization_id}/projects/{project_id}/profiles/{profile_id}",
        params={"format": "sample"},
    )

    if response.status == 200:
        profile = orjson.loads(response.data)
        execution_tree = _convert_profile_to_execution_tree(profile)
        output = (
            None
            if not execution_tree
            else {
                "profile_matches_issue": True,
                "execution_tree": execution_tree,
            }
        )
        return output


def get_error_event_details(project_id: int, event_id: str):
    event = eventstore.backend.get_event_by_id(project_id, event_id)
    if not event:
        return None

    serialized_event = serialize(objects=event, user=None, serializer=EventSerializer())
    return serialized_event
