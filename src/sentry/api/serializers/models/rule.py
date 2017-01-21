from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import Rule


def _generate_rule_label(project, rule, data):
    from sentry.rules import rules

    rule_cls = rules.get(data['id'])
    if rule_cls is None:
        return

    rule_inst = rule_cls(project, data=data, rule=rule)
    return rule_inst.render_label()


@register(Rule)
class RuleSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            # XXX(dcramer): we currently serialize unsaved rule objects
            # as part of the rule editor
            'id': six.text_type(obj.id) if obj.id else None,
            'conditions': [
                dict({
                    'name': _generate_rule_label(obj.project, obj, o),
                }, **o) for o in obj.data.get('conditions', [])
            ],
            'actions': [
                dict({
                    'name': _generate_rule_label(obj.project, obj, o),
                }, **o) for o in obj.data.get('actions', [])
            ],
            'actionMatch': obj.data.get('action_match') or Rule.DEFAULT_ACTION_MATCH,
            'frequency': obj.data.get('frequency') or Rule.DEFAULT_FREQUENCY,
            'name': obj.label,
            'dateCreated': obj.date_added,
        }
        return d
