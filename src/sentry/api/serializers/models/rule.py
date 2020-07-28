from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import Environment, Rule


def _generate_rule_label(project, rule, data):
    from sentry.rules import rules

    rule_cls = rules.get(data["id"])
    if rule_cls is None:
        return

    rule_inst = rule_cls(project, data=data, rule=rule)
    return rule_inst.render_label()


@register(Rule)
class RuleSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        environments = Environment.objects.in_bulk(
            [_f for _f in [i.environment_id for i in item_list] if _f]
        )
        return {i: {"environment": environments.get(i.environment_id)} for i in item_list}

    def serialize(self, obj, attrs, user):
        environment = attrs["environment"]
        d = {
            # XXX(dcramer): we currently serialize unsaved rule objects
            # as part of the rule editor
            "id": six.text_type(obj.id) if obj.id else None,
            "conditions": [
                dict(o.items() + [("name", _generate_rule_label(obj.project, obj, o))])
                for o in obj.data.get("conditions", [])
            ],
            "actions": [
                dict(o.items() + [("name", _generate_rule_label(obj.project, obj, o))])
                for o in obj.data.get("actions", [])
            ],
            "actionMatch": obj.data.get("action_match") or Rule.DEFAULT_ACTION_MATCH,
            "frequency": obj.data.get("frequency") or Rule.DEFAULT_FREQUENCY,
            "name": obj.label,
            "dateCreated": obj.date_added,
            "createdBy": obj.created_by,
            "environment": environment.name if environment is not None else None,
        }
        return d
