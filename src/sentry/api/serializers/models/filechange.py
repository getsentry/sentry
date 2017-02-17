from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import CommitFileChange


@register(CommitFileChange)
class CommitFileChangeSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'org_id': obj.organization_id,
            'author': obj.commit.author.name,
            'commit_message': obj.commit.message,
            'filename': obj.filename,
            'type': obj.type
        }
