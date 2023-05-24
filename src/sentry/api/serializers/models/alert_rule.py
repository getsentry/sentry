from collections import defaultdict
from typing import MutableMapping

from django.db.models import Max, prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.rule import RuleSerializer
from sentry.incidents.models import (
    AlertRule,
    AlertRuleActivity,
    AlertRuleActivityType,
    AlertRuleExcludedProjects,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    Incident,
)
from sentry.models.actor import ACTOR_TYPES, Actor, actor_type_to_string
from sentry.models.rule import Rule
from sentry.services.hybrid_cloud.app import app_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.snuba.models import SnubaQueryEventType


@register(AlertRule)
class AlertRuleSerializer(Serializer):
    def __init__(self, expand=None):
        self.expand = expand or []

    def get_attrs(self, item_list, user, **kwargs):
        alert_rules = {item.id: item for item in item_list}
        prefetch_related_objects(item_list, "snuba_query__environment")

        result = defaultdict(dict)
        triggers = AlertRuleTrigger.objects.filter(alert_rule__in=item_list).order_by("label")
        serialized_triggers = serialize(list(triggers), **kwargs)

        trigger_actions = AlertRuleTriggerAction.objects.filter(
            alert_rule_trigger__alert_rule_id__in=alert_rules.keys()
        ).exclude(sentry_app_config__isnull=True, sentry_app_id__isnull=True)

        sentry_app_installations_by_sentry_app_id = app_service.get_related_sentry_app_components(
            organization_ids=[alert_rule.organization_id for alert_rule in alert_rules.values()],
            sentry_app_ids=trigger_actions.values_list("sentry_app_id", flat=True),
            type="alert-rule-action",
        )

        for trigger, serialized in zip(triggers, serialized_triggers):
            alert_rule_triggers = result[alert_rules[trigger.alert_rule_id]].setdefault(
                "triggers", []
            )
            for action in serialized.get("actions", []):
                install = sentry_app_installations_by_sentry_app_id.get(action.get("sentryAppId"))
                if install:
                    action["_sentry_app_component"] = install.get("sentry_app_component")
                    action["_sentry_app_installation"] = install.get("sentry_app_installation")
                    action["sentryAppInstallationUuid"] = install.get(
                        "sentry_app_installation"
                    ).get("uuid")
            alert_rule_triggers.append(serialized)

        alert_rule_projects = AlertRule.objects.filter(
            id__in=[item.id for item in item_list]
        ).values_list("id", "snuba_query__subscriptions__project__slug")
        for alert_rule_id, project_slug in alert_rule_projects:
            rule_result = result[alert_rules[alert_rule_id]].setdefault("projects", [])
            rule_result.append(project_slug)

        rule_activities = list(
            AlertRuleActivity.objects.filter(
                alert_rule__in=item_list, type=AlertRuleActivityType.CREATED.value
            )
        )

        use_by_user_id: MutableMapping[int, RpcUser] = {
            user.id: user
            for user in user_service.get_many(
                filter=dict(user_ids=[r.user_id for r in rule_activities])
            )
        }
        for rule_activity in rule_activities:
            rpc_user = use_by_user_id.get(rule_activity.user_id)
            if rpc_user:
                user = dict(id=rpc_user.id, name=rpc_user.get_display_name(), email=rpc_user.email)
            else:
                user = None
            result[alert_rules[rule_activity.alert_rule_id]]["created_by"] = user

        owners_by_type = defaultdict(list)
        for item in item_list:
            if item.owner_id is not None:
                owners_by_type[actor_type_to_string(item.owner.type)].append(item.owner_id)

        resolved_actors = {}
        for k, v in ACTOR_TYPES.items():
            actors = Actor.objects.filter(type=v, id__in=owners_by_type[k])
            if k == "team":
                resolved_actors[k] = {actor.id: actor.team_id for actor in actors}
            if k == "user":
                resolved_actors[k] = {actor.id: actor.user_id for actor in actors}

        for alert_rule in alert_rules.values():
            if alert_rule.owner_id:
                type = actor_type_to_string(alert_rule.owner.type)
                if alert_rule.owner_id in resolved_actors[type]:
                    result[alert_rule][
                        "owner"
                    ] = f"{type}:{resolved_actors[type][alert_rule.owner_id]}"

        if "original_alert_rule" in self.expand:
            snapshot_activities = AlertRuleActivity.objects.filter(
                alert_rule__in=item_list,
                type=AlertRuleActivityType.SNAPSHOT.value,
            )
            for activity in snapshot_activities:
                result[alert_rules[activity.alert_rule_id]][
                    "originalAlertRuleId"
                ] = activity.previous_alert_rule_id

        if "latestIncident" in self.expand:
            incident_map = {}
            for incident in Incident.objects.filter(
                id__in=Incident.objects.filter(alert_rule__in=alert_rules)
                .values("alert_rule_id")
                .annotate(incident_id=Max("id"))
                .values("incident_id")
            ):
                incident_map[incident.alert_rule_id] = serialize(incident, user=user)
            for alert_rule in alert_rules.values():
                result[alert_rule]["latestIncident"] = incident_map.get(alert_rule.id, None)

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        from sentry.incidents.endpoints.utils import translate_threshold
        from sentry.incidents.logic import translate_aggregate_field

        env = obj.snuba_query.environment
        # Temporary: Translate aggregate back here from `tags[sentry:user]` to `user` for the frontend.
        aggregate = translate_aggregate_field(obj.snuba_query.aggregate, reverse=True)
        data = {
            "id": str(obj.id),
            "name": obj.name,
            "organizationId": str(obj.organization_id),
            "status": obj.status,
            "queryType": obj.snuba_query.type,
            "dataset": obj.snuba_query.dataset,
            "query": obj.snuba_query.query,
            "aggregate": aggregate,
            "thresholdType": obj.threshold_type,
            "resolveThreshold": translate_threshold(obj, obj.resolve_threshold),
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
            "originalAlertRuleId": attrs.get("originalAlertRuleId", None),
            "comparisonDelta": obj.comparison_delta / 60 if obj.comparison_delta else None,
            "dateModified": obj.date_modified,
            "dateCreated": obj.date_added,
            "createdBy": attrs.get("created_by", None),
        }
        if "latestIncident" in self.expand:
            data["latestIncident"] = attrs.get("latestIncident", None)

        return data


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

    def serialize(self, obj, attrs, user, **kwargs):
        data = super().serialize(obj, attrs, user)
        data["excludedProjects"] = sorted(attrs.get("excluded_projects", []))
        data["eventTypes"] = sorted(attrs.get("event_types", []))
        return data


class CombinedRuleSerializer(Serializer):
    def __init__(self, expand=None):
        self.expand = expand or []

    def get_attrs(self, item_list, user, **kwargs):
        results = super().get_attrs(item_list, user)

        alert_rules = [x for x in item_list if isinstance(x, AlertRule)]
        incident_map = {}
        if "latestIncident" in self.expand:
            for incident in Incident.objects.filter(id__in=[x.incident_id for x in alert_rules]):
                incident_map[incident.id] = serialize(incident, user=user)

        serialized_alert_rules = serialize(alert_rules, user=user)
        rules = serialize(
            [x for x in item_list if isinstance(x, Rule)],
            user=user,
            serializer=RuleSerializer(expand=self.expand),
        )

        for item in item_list:
            if isinstance(item, AlertRule):
                alert_rule = serialized_alert_rules.pop(0)
                if "latestIncident" in self.expand:
                    alert_rule["latestIncident"] = incident_map.get(item.incident_id)
                results[item] = alert_rule
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
            raise AssertionError(f"Invalid rule to serialize: {type(obj)}")
