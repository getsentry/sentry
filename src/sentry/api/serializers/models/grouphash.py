from __future__ import absolute_import

from collections import defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Event, GroupHash


def get_latest_events(group_hash_list):
    """
    Fetch the latest events for a collection of ``GroupHash`` instances.
    Returns a list of events (or ``None``) in the same order as the input
    sequence.
    """
    group_hashes_by_project_id = defaultdict(list)
    for group_hash in group_hash_list:
        group_hashes_by_project_id[group_hash.project_id].append(group_hash)

    events_by_group_hash = {}
    for project_id, group_hash_list_chunk in group_hashes_by_project_id.items():
        event_id_list = GroupHash.fetch_last_processed_event_id(
            [i.id for i in group_hash_list_chunk])
        event_by_event_id = {
            event.event_id: event
            for event in Event.objects.filter(
                project_id=project_id,
                event_id__in=filter(None, event_id_list),
            )
        }
        for group_hash, event_id in zip(group_hash_list_chunk, event_id_list):
            event = event_by_event_id.get(event_id)
            if event is not None and event.group_id == group_hash.group_id:
                events_by_group_hash[group_hash] = event

    return [events_by_group_hash.get(group_hash) for group_hash in group_hash_list]


@register(GroupHash)
class GroupHashSerializer(Serializer):
    state_text_map = {
        None: 'unlocked',
        GroupHash.State.LOCKED_IN_MIGRATION: 'locked',
    }

    def get_attrs(self, item_list, user, *args, **kwargs):
        return {
            item: {
                'latest_event': latest_event
            }
            for item, latest_event in zip(
                item_list,
                serialize(
                    get_latest_events(item_list),
                    user=user,
                ),
            )
        }

    def serialize(self, obj, attrs, user):
        return {
            'id': obj.hash,
            'latestEvent': attrs['latest_event'],
            'state': self.state_text_map[obj.state],
        }
