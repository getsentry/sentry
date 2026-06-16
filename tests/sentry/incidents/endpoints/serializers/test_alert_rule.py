from typing import Any

from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.rule import Rule
from sentry.snuba.models import ExtrapolationMode
from sentry.types.actor import Actor
from sentry.users.services.user.service import user_service

NOT_SET = object()


class BaseAlertRuleSerializerTest:
    def assert_alert_rule_serialized(
        self, alert_rule, result, skip_dates=False, resolve_threshold=NOT_SET
    ):
        alert_rule_projects = sorted(
            slug
            for slug in AlertRule.objects.filter(id=alert_rule.id).values_list(
                "projects__slug", flat=True
            )
            if slug is not None
        )
        assert result["id"] == str(alert_rule.id)
        assert result["organizationId"] == str(alert_rule.organization_id)
        assert result["name"] == alert_rule.name
        assert result["queryType"] == alert_rule.snuba_query.type
        assert result["dataset"] == alert_rule.snuba_query.dataset
        assert result["query"] == alert_rule.snuba_query.query
        assert result["aggregate"] == alert_rule.snuba_query.aggregate
        assert result["thresholdType"] == alert_rule.threshold_type
        assert result["resolveThreshold"] == (
            alert_rule.resolve_threshold if resolve_threshold is NOT_SET else resolve_threshold
        )
        assert result["timeWindow"] == alert_rule.snuba_query.time_window / 60
        assert result["resolution"] == alert_rule.snuba_query.resolution / 60
        assert result["thresholdPeriod"] == alert_rule.threshold_period
        assert result["projects"] == alert_rule_projects
        if alert_rule.created_by_id:
            created_by = user_service.get_user(user_id=alert_rule.created_by_id)
            assert created_by is not None
            assert result["createdBy"] == {
                "id": alert_rule.created_by_id,
                "name": created_by.get_display_name(),
                "email": created_by.email,
            }
        else:
            assert result["createdBy"] is None
        if not skip_dates:
            assert result["dateModified"] == alert_rule.date_modified
            assert result["dateCreated"] == alert_rule.date_added
        if alert_rule.snuba_query.environment:
            assert result["environment"] == alert_rule.snuba_query.environment.name
        else:
            assert result["environment"] is None

        if alert_rule.user_id or alert_rule.team_id:
            owner = Actor.from_id(user_id=alert_rule.user_id, team_id=alert_rule.team_id)
            assert owner
            assert result["owner"] == owner.identifier
        else:
            assert result["owner"] is None

        if alert_rule.comparison_delta:
            assert result["comparisonDelta"] == alert_rule.comparison_delta / 60
        else:
            assert result["comparisonDelta"] is None

        if alert_rule.snuba_query.extrapolation_mode is not None:
            assert (
                result["extrapolationMode"]
                == ExtrapolationMode(alert_rule.snuba_query.extrapolation_mode).name.lower()
            )
        else:
            assert result.get("extrapolationMode") is None

    def create_issue_alert_rule(self, data: dict[str, Any]) -> Rule:
        """data format
        {
            "project": project
            "environment": environment
            "name": "My rule name",
            "owner": actor id,
            "conditions": [],
            "actions": [],
            "actionMatch": "all"
        }
        """
        rule = Rule()
        rule.project = data["project"]
        if "environment" in data:
            environment = data["environment"]
            rule.environment_id = int(environment) if environment else environment
        if data.get("name"):
            rule.label = data["name"]
        if data.get("actionMatch"):
            rule.data["action_match"] = data["actionMatch"]
        if data.get("actions") is not None:
            rule.data["actions"] = data["actions"]
        if data.get("conditions") is not None:
            rule.data["conditions"] = data["conditions"]
        if data.get("frequency"):
            rule.data["frequency"] = data["frequency"]
        if data.get("date_added"):
            rule.date_added = data["date_added"]
        if data.get("owner"):
            actor = Actor.from_identifier(data["owner"])
            if actor.is_user:
                rule.owner_user_id = actor.id
            if actor.is_team:
                rule.owner_team_id = actor.id

        rule.save()
        return rule
