from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import ProjectKey


@register(ProjectKey)
class ProjectKeySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': obj.public_key,
            'label': obj.label,
            'public': obj.public_key,
            'secret': obj.secret_key,
            'dsn': {
                'secret': obj.dsn_private,
                'public': obj.dsn_public,
                'csp': obj.csp_endpoint,
            },
            'dateCreated': obj.date_added,
        }
        return d
