from collections import defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.incidents.logic import translate_aggregate_field
from sentry.incidents.models import (
    AlertRule,
    AlertRuleActivity,
    AlertRuleActivityType,
    AlertRuleExcludedProjects,
    AlertRuleTrigger,
)
from sentry.models import ACTOR_TYPES, Rule, actor_type_to_class, actor_type_to_string
from sentry.snuba.models import SnubaQueryEventType
from sentry.utils.compat import zip
from sentry.utils.db import attach_foreignkey


@register(AlertRule)
class AlertRuleSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        alert_rules = {item.id: item for item in item_list}
        attach_foreignkey(item_list, AlertRule.snuba_query, related=("environment",))

        result = defaultdict(dict)
        triggers = AlertRuleTrigger.objects.filter(alert_rule__in=item_list).order_by("label")
        serialized_triggers = serialize(list(triggers))
        for trigger, serialized in zip(triggers, serialized_triggers):
            alert_rule_triggers = result[alert_rules[trigger.alert_rule_id]].setdefault(
                "triggers", []
            )
            alert_rule_triggers.append(serialized)

        alert_rule_projects = AlertRule.objects.filter(
            id__in=[item.id for item in item_list]
        ).values_list("id", "snuba_query__subscriptions__project__slug")
        for alert_rule_id, project_slug in alert_rule_projects:
            rule_result = result[alert_rules[alert_rule_id]].setdefault("projects", [])
            rule_result.append(project_slug)

        for rule_activity in AlertRuleActivity.objects.filter(
            alert_rule__in=item_list, type=AlertRuleActivityType.CREATED.value
        ).select_related("alert_rule", "user"):
            if rule_activity.user:
                user = {
                    "id": rule_activity.user.id,
                    "name": rule_activity.user.get_display_name(),
                    "email": rule_activity.user.email,
                }
            else:
                user = None

            result[alert_rules[rule_activity.alert_rule.id]].update({"created_by": user})

        resolved_actors = {}
        owners_by_type = defaultdict(list)
        for item in item_list:
            if item.owner_id is not None:
                owners_by_type[actor_type_to_string(item.owner.type)].append(item.owner_id)

        for k, v in ACTOR_TYPES.items():
            resolved_actors[k] = {
                a.actor_id: a.id
                for a in actor_type_to_class(v).objects.filter(actor_id__in=owners_by_type[k])
            }

        for alert_rule in alert_rules.values():
            if alert_rule.owner_id:
                type = actor_type_to_string(alert_rule.owner.type)
                result[alert_rule]["owner"] = f"{type}:{resolved_actors[type][alert_rule.owner_id]}"

        return result

    def serialize(self, obj, attrs, user):
        env = obj.snuba_query.environment
        # Temporary: Translate aggregate back here from `tags[sentry:user]` to `user` for the frontend.
        aggregate = translate_aggregate_field(obj.snuba_query.aggregate, reverse=True)
        return {
            "id": str(obj.id),
            "name": obj.name,
            "organizationId": str(obj.organization_id),
            "status": obj.status,
            "dataset": obj.snuba_query.dataset,
            "query": obj.snuba_query.query,
            "aggregate": aggregate,
            "thresholdType": obj.threshold_type,
            "resolveThreshold": obj.resolve_threshold,
            # TODO: Start having the frontend expect seconds
            "timeWindow": obj.snuba_query.time_window / 60,
            "environment": env.name if env else None,
            # TODO: Start having the frontend expect seconds
            "resolution": obj.snuba_query.resolution / 60,
            "thresholdPeriod": obj.threshold_period,
            "triggers": attrs.get("triggers", []),
            "projects": sorted(attrs.get("projects", [])),
            "includeAllProjects": obj.include_all_projects,
            "owner": attrs.get("owner", None),
            "dateModified": obj.date_modified,
            "dateCreated": obj.date_added,
            "createdBy": attrs.get("created_by", None),
        }


class DetailedAlertRuleSerializer(AlertRuleSerializer):
    def get_attrs(self, item_list, user, **kwargs):
        result = super().get_attrs(item_list, user, **kwargs)
        alert_rules = {item.id: item for item in item_list}
        for alert_rule_id, project_slug in AlertRuleExcludedProjects.objects.filter(
            alert_rule__in=item_list
        ).values_list("alert_rule_id", "project__slug"):
            exclusions = result[alert_rules[alert_rule_id]].setdefault("excluded_projects", [])
            exclusions.append(project_slug)

        query_to_alert_rule = {ar.snuba_query_id: ar for ar in item_list}

        for event_type in SnubaQueryEventType.objects.filter(
            snuba_query_id__in=[item.snuba_query_id for item in item_list]
        ):
            event_types = result[query_to_alert_rule[event_type.snuba_query_id]].setdefault(
                "event_types", []
            )
            event_types.append(SnubaQueryEventType.EventType(event_type.type).name.lower())

        return result

    def serialize(self, obj, attrs, user):
        data = super().serialize(obj, attrs, user)
        data["excludedProjects"] = sorted(attrs.get("excluded_projects", []))
        data["eventTypes"] = sorted(attrs.get("event_types", []))
        return data


class CombinedRuleSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        results = super().get_attrs(item_list, user)

        alert_rules = serialize([x for x in item_list if isinstance(x, AlertRule)], user=user)
        rules = serialize([x for x in item_list if isinstance(x, Rule)], user=user)

        for item in item_list:
            if isinstance(item, AlertRule):
                results[item] = alert_rules.pop(0)
            elif isinstance(item, Rule):
                results[item] = rules.pop(0)

        return results

    def serialize(self, obj, attrs, user, **kwargs):
        if isinstance(obj, AlertRule):
            attrs["type"] = "alert_rule"
            return attrs
        elif isinstance(obj, Rule):
            attrs["type"] = "rule"
            return attrs
        else:
            raise AssertionError("Invalid rule to serialize: %r" % type(obj))
