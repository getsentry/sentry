from collections import defaultdict
from typing import List

from django.db.models import Max, prefetch_related_objects
from rest_framework import serializers

from sentry.api.serializers import Serializer, register
from sentry.models import (
    ACTOR_TYPES,
    Environment,
    Rule,
    RuleActivity,
    RuleActivityType,
    RuleFireHistory,
    actor_type_to_string,
)
from sentry.models.actor import Actor
from sentry.services.hybrid_cloud.user.service import user_service


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
    def __init__(self, expand=None):
        super().__init__()
        self.expand = expand or []

    def get_attrs(self, item_list, user, **kwargs):
        from sentry.services.hybrid_cloud.app import app_service

        prefetch_related_objects(item_list, "project")

        environments = Environment.objects.in_bulk(
            [_f for _f in [i.environment_id for i in item_list] if _f]
        )

        result = {i: {"environment": environments.get(i.environment_id)} for i in item_list}
        ras = list(
            RuleActivity.objects.filter(
                rule__in=item_list, type=RuleActivityType.CREATED.value
            ).select_related("rule")
        )

        users = {
            u.id: u for u in user_service.get_many(filter=dict(user_ids=[ra.user_id for ra in ras]))
        }

        for rule_activity in ras:
            u = users.get(rule_activity.user_id)
            if u:
                user = {
                    "id": u.id,
                    "name": u.get_display_name(),
                    "email": u.email,
                }
            else:
                user = None

            result[rule_activity.rule].update({"created_by": user})

        rules = {item.id: item for item in item_list}
        resolved_actors = {}
        owners_by_type = defaultdict(list)

        sentry_app_uuids = [
            action.get("sentryAppInstallationUuid")
            for rule in rules.values()
            for action in rule.data.get("actions", [])
        ]

        sentry_app_ids: List[int] = [
            i.sentry_app.id for i in app_service.get_many(filter=dict(uuids=sentry_app_uuids))
        ]
        sentry_app_installations_by_uuid = app_service.get_related_sentry_app_components(
            organization_ids=[rule.project.organization_id for rule in rules.values()],
            sentry_app_ids=sentry_app_ids,
            type="alert-rule-action",
            group_by="uuid",
        )

        for item in item_list:
            if item.owner_id is not None:
                owners_by_type[actor_type_to_string(item.owner.type)].append(item.owner_id)

        for k, v in ACTOR_TYPES.items():
            actors = Actor.objects.filter(type=v, id__in=owners_by_type[k])
            if k == "team":
                resolved_actors[k] = {actor.id: actor.team_id for actor in actors}
            if k == "user":
                resolved_actors[k] = {actor.id: actor.user_id for actor in actors}

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

        if "lastTriggered" in self.expand:
            last_triggered_lookup = {
                rfh["rule_id"]: rfh["date_added"]
                for rfh in RuleFireHistory.objects.filter(rule__in=item_list)
                .values("rule_id")
                .annotate(date_added=Max("date_added"))
            }
            for rule in item_list:
                result[rule]["last_triggered"] = last_triggered_lookup.get(rule.id, None)

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        environment = attrs["environment"]
        all_conditions = [
            dict(list(o.items()) + [("name", _generate_rule_label(obj.project, obj, o))])
            for o in obj.data.get("conditions", [])
        ]

        actions = []
        for action in obj.data.get("actions", []):
            try:
                actions.append(
                    dict(
                        list(action.items())
                        + [("name", _generate_rule_label(obj.project, obj, action))]
                    )
                )
            except serializers.ValidationError:
                # Integrations can be deleted and we don't want to fail to load the rule
                pass

        d = {
            # XXX(dcramer): we currently serialize unsaved rule objects
            # as part of the rule editor
            "id": str(obj.id) if obj.id else None,
            # conditions pertain to criteria that can trigger an alert
            "conditions": list(filter(lambda condition: not _is_filter(condition), all_conditions)),
            # filters are not new conditions but are the subset of conditions that pertain to event attributes
            "filters": list(filter(lambda condition: _is_filter(condition), all_conditions)),
            "actions": actions,
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
        if "last_triggered" in attrs:
            d["lastTriggered"] = attrs["last_triggered"]
        return d
