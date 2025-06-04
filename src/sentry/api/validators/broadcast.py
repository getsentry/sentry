from rest_framework import serializers

from sentry.models.broadcast import BROADCAST_CATEGORIES


class BroadcastValidator(serializers.Serializer):
    hasSeen = serializers.BooleanField(required=False)


class AdminBroadcastValidator(BroadcastValidator):
    title = serializers.CharField(max_length=64, required=True)
    message = serializers.CharField(max_length=256, required=True)
    link = serializers.URLField(required=True)
    isActive = serializers.BooleanField(required=False)
    dateExpires = serializers.DateTimeField(required=False, allow_null=True)
    cta = serializers.CharField(max_length=256, required=False)
    mediaUrl = serializers.URLField(required=False)
    category = serializers.ChoiceField(choices=BROADCAST_CATEGORIES, required=False)
