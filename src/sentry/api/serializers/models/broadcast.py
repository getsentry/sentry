from __future__ import absolute_import

import six

from django.db.models import Count

from sentry.api.serializers import Serializer, register
from sentry.models import Broadcast, BroadcastSeen


@register(Broadcast)
class BroadcastSerializer(Serializer):
    def get_attrs(self, item_list, user):
        if not user.is_authenticated():
            seen = set()
        else:
            seen = set(
                BroadcastSeen.objects.filter(broadcast__in=item_list, user=user).values_list(
                    "broadcast", flat=True
                )
            )

        return {item: {"seen": item.id in seen} for item in item_list}

    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "message": obj.message,
            "title": obj.title,
            "link": obj.link,
            "cta": obj.cta,
            "isActive": obj.is_active,
            "dateCreated": obj.date_added,
            "dateExpires": obj.date_expires,
            "hasSeen": attrs["seen"],
        }


class AdminBroadcastSerializer(BroadcastSerializer):
    def get_attrs(self, item_list, user):
        attrs = super(AdminBroadcastSerializer, self).get_attrs(item_list, user)
        counts = dict(
            BroadcastSeen.objects.filter(broadcast__in=item_list)
            .values("broadcast")
            .distinct()
            .annotate(user_count=Count("broadcast"))
            .values_list("broadcast", "user_count")
        )

        for item in attrs:
            attrs[item]["user_count"] = counts.get(item.id, 0)
        return attrs

    def serialize(self, obj, attrs, user):
        context = super(AdminBroadcastSerializer, self).serialize(obj, attrs, user)
        context["userCount"] = attrs["user_count"]
        return context
