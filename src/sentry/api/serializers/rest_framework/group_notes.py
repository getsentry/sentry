from __future__ import absolute_import

from rest_framework import serializers

from .list import ListField
from sentry.api.fields.actor import ActorField
from sentry.api.serializers.rest_framework.mentions import MentionsMixin


class NoteSerializer(serializers.Serializer, MentionsMixin):
    text = serializers.CharField()
    mentions = ListField(child=ActorField(), required=False)
    external_id = serializers.CharField(allow_null=True, required=False)
