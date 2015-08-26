from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Rule


@register(Rule)
class RuleSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            # XXX(dcramer): we currently serialize unsaved rule objects
            # as part of the rule editor
            'id': str(obj.id) if obj.id else None,
            'conditions': obj.data.get('conditions', []),
            'actions': obj.data.get('actions', []),
            'actionMatch': obj.data.get('action_match', 'all'),
            'name': obj.label,
            'dateCreated': obj.date_added,
        }
        return d
