from sentry.api.serializers import Serializer, register
from sentry.models.groupgithubactivity import FEED_STATUSES, FEED_TYPES, GroupGithubActivity


@register(GroupGithubActivity)
class GroupGithubActivitySerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "url": obj.url,
            "title": obj.display_name,
            "state": FEED_STATUSES[obj.feed_status],
            "type": FEED_TYPES[obj.feed_type],
            "author": obj.author.name,
            "visible": obj.visible,
        }
