from collections.abc import Sequence
from typing import Any

from rest_framework import serializers

from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.notifications.types import AssigneeTargetType
from sentry.users.services.user.service import user_service
from sentry.utils.cache import cache
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.ASSIGNED_TO)
class AssignedToConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.ISSUE_ATTRIBUTES
    label_template = "The issue is assigned to {targetType}"

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "target_type": {"type": "string", "enum": [*AssigneeTargetType]},
            "target_identifier": {"type": ["integer", "string"]},
        },
        "required": ["target_type"],
        "additionalProperties": False,
        "allOf": [
            {
                "if": {"properties": {"target_type": {"const": AssigneeTargetType.UNASSIGNED}}},
                "then": {"required": ["target_type"]},
                "else": {"required": ["target_type", "target_identifier"]},
            }
        ],
    }

    @classmethod
    def validate_comparison(
        cls, comparison: dict[str, Any], organization: Organization
    ) -> dict[str, Any]:
        target_type = comparison.get("target_type")
        target_identifier = comparison.get("target_identifier")
        if target_type == AssigneeTargetType.UNASSIGNED.value or not target_identifier:
            return comparison

        try:
            target_identifier = int(target_identifier)
        except (TypeError, ValueError):
            raise serializers.ValidationError("target_identifier must be an integer")

        if target_type == AssigneeTargetType.TEAM.value:
            if not Team.objects.filter(id=target_identifier, organization=organization).exists():
                raise serializers.ValidationError("This team is not part of the organization.")
        elif target_type == AssigneeTargetType.MEMBER.value:
            if not OrganizationMember.objects.filter(
                user_id=target_identifier, organization=organization
            ).exists():
                raise serializers.ValidationError("This user is not part of the organization.")

        return comparison

    @staticmethod
    def get_assignees(group: Group) -> Sequence[GroupAssignee]:
        cache_key = f"group:{group.id}:assignees"
        assignee_list: Sequence[GroupAssignee] | None = cache.get(cache_key)
        if assignee_list is None:
            assignee_list = list(group.assignee_set.all())
            cache.set(cache_key, assignee_list, 60)
        return assignee_list

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group
        target_type = AssigneeTargetType(comparison.get("target_type"))

        assignees = event_data._cache.get("group_assignees")
        if assignees is None:
            assignees = AssignedToConditionHandler.get_assignees(group)
            event_data._cache["group_assignees"] = assignees

        if target_type == AssigneeTargetType.UNASSIGNED:
            return len(assignees) == 0

        target_id = comparison.get("target_identifier")

        if target_type == AssigneeTargetType.TEAM:
            return any(assignee.team_id and assignee.team_id == target_id for assignee in assignees)
        elif target_type == AssigneeTargetType.MEMBER:
            return any(assignee.user_id and assignee.user_id == target_id for assignee in assignees)

    @classmethod
    def render_label(cls, condition_data: dict[str, Any], organization_id: int) -> str:
        target_type: str | None = condition_data.get("targetType")
        if target_type is None:
            return cls.label_template.format(**condition_data)
        assignee_target_type = AssigneeTargetType(target_type)
        target_identifer: str | None = condition_data.get("targetIdentifier")
        if assignee_target_type == AssigneeTargetType.TEAM:
            if target_identifer is None:
                return cls.label_template.format(**condition_data)
            try:
                team = Team.objects.get(id=target_identifer, organization_id=organization_id)
            except Team.DoesNotExist:
                return cls.label_template.format(**condition_data)
            return cls.label_template.format(targetType=f"team #{team.slug}")

        elif assignee_target_type == AssigneeTargetType.MEMBER:
            if target_identifer is None:
                return cls.label_template.format(**condition_data)
            try:
                user_id = int(target_identifer)
            except (ValueError, TypeError):
                return cls.label_template.format(**condition_data)

            if not OrganizationMember.objects.filter(
                user_id=user_id, organization_id=organization_id
            ).exists():
                return cls.label_template.format(**condition_data)

            user = user_service.get_user(user_id=user_id)
            if user is not None:
                return cls.label_template.format(targetType=user.username)
            else:
                return cls.label_template.format(**condition_data)

        return cls.label_template.format(**condition_data)
