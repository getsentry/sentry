from collections import defaultdict

from sentry.api.serializers import Serializer, register
from sentry.models import (
    ACTOR_TYPES,
    Environment,
    Rule,
    RuleActivity,
    RuleActivityType,
    SentryAppInstallation,
    actor_type_to_class,
    actor_type_to_string,
)
from sentry.utils.compat import filter


def _generate_rule_label(project, rule, data):
    from sentry.rules import rules

    rule_cls = rules.get(data["id"])
    if rule_cls is None:
        return

    rule_inst = rule_cls(project, data=data, rule=rule)
    return rule_inst.render_label()


def _is_filter(data):
    from sentry.rules import rules

    rule_cls = rules.get(data["id"])
    return rule_cls.rule_type == "filter/event"


@register(Rule)
class RuleSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        environments = Environment.objects.in_bulk(
            [_f for _f in [i.environment_id for i in item_list] if _f]
        )

        result = {i: {"environment": environments.get(i.environment_id)} for i in item_list}
        for rule_activity in RuleActivity.objects.filter(
            rule__in=item_list, type=RuleActivityType.CREATED.value
        ).select_related("rule", "user"):
            if rule_activity.user:
                user = {
                    "id": rule_activity.user.id,
                    "name": rule_activity.user.get_display_name(),
                    "email": rule_activity.user.email,
                }
            else:
                user = None

            result[rule_activity.rule].update({"created_by": user})

        rules = {item.id: item for item in item_list}
        resolved_actors = {}
        owners_by_type = defaultdict(list)

        sentry_app_uuids = {
            action.get("sentryAppInstallationUuid")
            for rule in rules.values()
            for action in rule.data.get("actions", [])
        }

        sentry_app_ids = (
            SentryAppInstallation.objects.filter(uuid__in=sentry_app_uuids)
            .distinct("sentry_app_id")
            .values_list("sentry_app_id", flat=True)
        )

        sentry_app_installations_by_uuid = (
            SentryAppInstallation.objects.get_related_sentry_app_components(
                organization_ids={rule.project.organization_id for rule in rules.values()},
                sentry_app_ids=sentry_app_ids,
                type="alert-rule-action",
                group_by="uuid",
            )
        )

        for item in item_list:
            if item.owner_id is not None:
                owners_by_type[actor_type_to_string(item.owner.type)].append(item.owner_id)

        for k, v in ACTOR_TYPES.items():
            resolved_actors[k] = {
                a.actor_id: a.id
                for a in actor_type_to_class(v).objects.filter(actor_id__in=owners_by_type[k])
            }
        for rule in rules.values():
            if rule.owner_id:
                type = actor_type_to_string(rule.owner.type)
                if rule.owner_id in resolved_actors[type]:
                    result[rule]["owner"] = f"{type}:{resolved_actors[type][rule.owner_id]}"

            for action in rule.data.get("actions", []):
                install = sentry_app_installations_by_uuid.get(
                    action.get("sentryAppInstallationUuid")
                )
                if install:
                    action["_sentry_app_component"] = install.get("sentry_app_component")
                    action["_sentry_app_installation"] = install.get("sentry_app_installation")

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        environment = attrs["environment"]
        all_conditions = [
            dict(list(o.items()) + [("name", _generate_rule_label(obj.project, obj, o))])
            for o in obj.data.get("conditions", [])
        ]

        d = {
            # XXX(dcramer): we currently serialize unsaved rule objects
            # as part of the rule editor
            "id": str(obj.id) if obj.id else None,
            # conditions pertain to criteria that can trigger an alert
            "conditions": filter(lambda condition: not _is_filter(condition), all_conditions),
            # filters are not new conditions but are the subset of conditions that pertain to event attributes
            "filters": filter(lambda condition: _is_filter(condition), all_conditions),
            "actions": [
                dict(list(o.items()) + [("name", _generate_rule_label(obj.project, obj, o))])
                for o in obj.data.get("actions", [])
            ],
            "actionMatch": obj.data.get("action_match") or Rule.DEFAULT_CONDITION_MATCH,
            "filterMatch": obj.data.get("filter_match") or Rule.DEFAULT_FILTER_MATCH,
            "frequency": obj.data.get("frequency") or Rule.DEFAULT_FREQUENCY,
            "name": obj.label,
            "dateCreated": obj.date_added,
            "owner": attrs.get("owner", None),
            "createdBy": attrs.get("created_by", None),
            "environment": environment.name if environment is not None else None,
            "projects": [obj.project.slug],
        }
        return d
