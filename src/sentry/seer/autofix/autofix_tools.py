from sentry.api.serializers import EventSerializer, serialize
from sentry.seer.explorer.utils import _convert_profile_to_execution_tree, fetch_profile_data
from sentry.services import eventstore


def get_profile_details(
    organization_id: int,
    project_id: int,
    profile_id: str,
    is_continuous: bool = False,
    precise_start_ts: float | None = None,
    precise_finish_ts: float | None = None,
):
    profile = fetch_profile_data(
        profile_id=profile_id,
        organization_id=organization_id,
        project_id=project_id,
        start_ts=precise_start_ts,
        end_ts=precise_finish_ts,
        is_continuous=is_continuous,
    )

    if profile:
        execution_tree, _ = _convert_profile_to_execution_tree(profile)
        return (
            None
            if not execution_tree
            else {
                "profile_matches_issue": True,
                "execution_tree": execution_tree,
            }
        )


def get_error_event_details(project_id: int, event_id: str):
    event = eventstore.backend.get_event_by_id(project_id, event_id)
    if not event:
        return None

    serialized_event = serialize(objects=event, user=None, serializer=EventSerializer())
    return serialized_event
