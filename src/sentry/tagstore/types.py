from sentry.api.serializers import Serializer, register, serialize
from sentry.search.utils import convert_user_tag_to_query
from sentry.types.tagstore import GroupTagKey, GroupTagValue, TagKey, TagValue


@register(GroupTagKey)
@register(TagKey)
class TagKeySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        from sentry import tagstore

        output = {
            "key": tagstore.get_standardized_key(obj.key),
            "name": tagstore.get_tag_key_label(obj.key),
        }
        if obj.values_seen is not None:
            output["uniqueValues"] = obj.values_seen
        if obj.count is not None:
            output["totalValues"] = obj.count
        if obj.top_values is not None:
            output["topValues"] = serialize(obj.top_values, user)
        return output


@register(GroupTagValue)
@register(TagValue)
class TagValueSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        from sentry import tagstore

        key = tagstore.get_standardized_key(obj.key)
        serialized = {
            "key": key,
            "name": tagstore.get_tag_value_label(obj.key, obj.value),
            "value": obj.value,
            "count": obj.times_seen,
            "lastSeen": obj.last_seen,
            "firstSeen": obj.first_seen,
        }

        query = convert_user_tag_to_query(key, obj.value)
        if query:
            serialized["query"] = query

        return serialized
