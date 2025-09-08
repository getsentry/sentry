from sentry.api.serializers import Serializer, register
from sentry.models.grouphashmetadata import GroupHashMetadata


@register(GroupHashMetadata)
class GroupHashMetadataSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "dateAdded": obj.date_added,
            "schemaVersion": obj.schema_version,
            "platform": obj.platform,
            "latestGroupingConfig": obj.latest_grouping_config,
            "hashBasis": obj.hash_basis,
            "hashingMetadata": obj.hashing_metadata,
            "seerDateSent": obj.seer_date_sent,
            "seerEventSent": obj.seer_event_sent,
            "seerModel": obj.seer_model,
            "seerMatchedGrouphash": obj.seer_matched_grouphash_id,
            "seerMatchDistance": obj.seer_match_distance,
        }
