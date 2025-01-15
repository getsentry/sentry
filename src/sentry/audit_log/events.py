from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sentry.audit_log.manager import AuditLogEvent
from sentry.utils.strings import truncatechars

if TYPE_CHECKING:
    from sentry.models.auditlogentry import AuditLogEntry
    from sentry.users.models.user import User


# AuditLogEvents with custom render functions


def _get_member_display(email: str | None, target_user: User | None) -> str:
    if email is not None:
        return email
    elif target_user is not None:
        return target_user.get_display_name()
    else:
        return "(unknown member)"


class MemberAddAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=2, name="MEMBER_ADD", api_name="member.add")

    def render(self, audit_log_entry: AuditLogEntry):
        if audit_log_entry.target_user == audit_log_entry.actor:
            return "joined the organization"

        member = _get_member_display(audit_log_entry.data.get("email"), audit_log_entry.target_user)
        return f"add member {member}"


class MemberEditAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=4, name="MEMBER_EDIT", api_name="member.edit")

    def render(self, audit_log_entry: AuditLogEntry):
        member = _get_member_display(audit_log_entry.data.get("email"), audit_log_entry.target_user)
        role = audit_log_entry.data.get("role") or "N/A"

        if "team_slugs" in audit_log_entry.data:
            teams = ", ".join(str(x) for x in audit_log_entry.data.get("team_slugs", []))
        else:
            teams = "N/A"
        return f"edited member {member} (role: {role}, teams: {teams})"


class MemberRemoveAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=5, name="MEMBER_REMOVE", api_name="member.remove")

    def render(self, audit_log_entry: AuditLogEntry):
        if audit_log_entry.target_user == audit_log_entry.actor:
            return "left the organization"

        member = _get_member_display(audit_log_entry.data.get("email"), audit_log_entry.target_user)
        return f"removed member {member}"


class MemberJoinTeamAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=6, name="MEMBER_JOIN_TEAM", api_name="member.join-team")

    def render(self, audit_log_entry: AuditLogEntry):
        if audit_log_entry.target_user == audit_log_entry.actor:
            return "joined team {team_slug}".format(**audit_log_entry.data)

        user_display_name = _get_member_display(
            audit_log_entry.data.get("email"), audit_log_entry.target_user
        )
        return "added {} to team {team_slug}".format(user_display_name, **audit_log_entry.data)


class MemberLeaveTeamAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=7, name="MEMBER_LEAVE_TEAM", api_name="member.leave-team")

    def render(self, audit_log_entry: AuditLogEntry):
        if audit_log_entry.target_user == audit_log_entry.actor:
            return "left team {team_slug}".format(**audit_log_entry.data)

        user_display_name = _get_member_display(
            audit_log_entry.data.get("email"), audit_log_entry.target_user
        )
        return "removed {} from team {team_slug}".format(user_display_name, **audit_log_entry.data)


class MemberPendingAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=8, name="MEMBER_PENDING", api_name="member.pending")

    def render(self, audit_log_entry: AuditLogEntry):
        user_display_name = _get_member_display(
            audit_log_entry.data.get("email"), audit_log_entry.target_user
        )
        return f"required member {user_display_name} to setup 2FA"


class OrgEditAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=11, name="ORG_EDIT", api_name="org.edit")

    def render(self, audit_log_entry: AuditLogEntry):
        items_string = ", ".join(f"{k} {v}" for k, v in audit_log_entry.data.items())
        return "edited the organization setting: " + items_string


class TeamEditAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=21, name="TEAM_EDIT", api_name="team.edit")

    def render(self, audit_log_entry: AuditLogEntry):
        slug = audit_log_entry.data["slug"]

        return f"edited team {slug}"


class ProjectEditAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=31, name="PROJECT_EDIT", api_name="project.edit")

    def render(self, audit_log_entry: AuditLogEntry):
        if "old_slug" in audit_log_entry.data:
            return "renamed project slug from {old_slug} to {new_slug}".format(
                **audit_log_entry.data
            )
        items_string = " ".join(
            f"in {key} to {value}" for (key, value) in audit_log_entry.data.items()
        )
        return "edited project settings " + items_string


class ProjectKeyEditAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=51, name="PROJECTKEY_EDIT", api_name="projectkey.edit")

    def render(self, audit_log_entry: AuditLogEntry):
        items_strings = []
        if "prev_rate_limit_count" in audit_log_entry.data:
            items_strings.append(
                " rate limit count from {prev_rate_limit_count} to {rate_limit_count}".format(
                    **audit_log_entry.data
                )
            )
        if "prev_rate_limit_window" in audit_log_entry.data:
            items_strings.append(
                " rate limit window from {prev_rate_limit_window} to {rate_limit_window}".format(
                    **audit_log_entry.data
                )
            )

        item_string = ""
        if items_strings:
            item_string = ":" + ",".join(items_strings)

        return "edited project key {public_key}".format(**audit_log_entry.data) + item_string


class ProjectPerformanceDetectionSettingsAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(
            event_id=178,
            name="PROJECT_PERFORMANCE_ISSUE_DETECTION_CHANGE",
            api_name="project.change-performance-issue-detection",
        )

    def render(self, audit_log_entry: AuditLogEntry):
        from sentry.api.endpoints.project_performance_issue_settings import (
            internal_only_project_settings_to_group_map as map,
        )

        data = audit_log_entry.data
        items_string = ", ".join(
            f"to {'enable' if value else 'disable'} detection of {map[key].description} issue"
            for (key, value) in data.items()
            if key in map.keys()
        )
        return "edited project performance issue detector settings " + items_string


def render_project_action(audit_log_entry: AuditLogEntry, action: str):
    # Most logs will just be name of the filter, but legacy browser changes can be bool, str, list, or sets
    filter_name = audit_log_entry.data["state"]
    slug = audit_log_entry.data.get("slug")

    message = f"{action} project filter {filter_name}"

    if filter_name in ("0", "1") or isinstance(filter_name, (bool, list, set)):
        message = f"{action} project filter legacy-browsers"
        if isinstance(filter_name, (list, set)):
            message += ": {}".format(", ".join(sorted(filter_name)))
    if slug:
        message += f" for project {slug}"
    return message


class ProjectEnableAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=37, name="PROJECT_ENABLE", api_name="project.enable")

    def render(self, audit_log_entry: AuditLogEntry):
        return render_project_action(audit_log_entry, "enable")


class ProjectDisableAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=38, name="PROJECT_DISABLE", api_name="project.disable")

    def render(self, audit_log_entry: AuditLogEntry):
        return render_project_action(audit_log_entry, "disable")


class ProjectOwnershipRuleEditAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(
            event_id=179, name="PROJECT_OWNERSHIPRULE_EDIT", api_name="project.ownership-rule.edit"
        )

    def render(self, audit_log_entry: AuditLogEntry):
        return "modified ownership rules"


class SSOEditAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=62, name="SSO_EDIT", api_name="sso.edit")

    def render(self, audit_log_entry: AuditLogEntry):
        settings = ", ".join(f"{k} {v}" for k, v in audit_log_entry.data.items())
        return "edited sso settings: " + settings


class ServiceHookAddAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=100, name="SERVICEHOOK_ADD", api_name="servicehook.create")

    def render(self, audit_log_entry: AuditLogEntry):
        full_url = audit_log_entry.data.get("url")
        return f'added a service hook for "{truncatechars(full_url, 64)}"'


class ServiceHookEditAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=101, name="SERVICEHOOK_EDIT", api_name="servicehook.edit")

    def render(self, audit_log_entry: AuditLogEntry):
        full_url = audit_log_entry.data.get("url")
        return f'edited the service hook for "{truncatechars(full_url, 64)}"'


class ServiceHookRemoveAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=102, name="SERVICEHOOK_REMOVE", api_name="servicehook.remove")

    def render(self, audit_log_entry: AuditLogEntry):
        full_url = audit_log_entry.data.get("url")
        return f'removed the service hook for "{truncatechars(full_url, 64)}"'


class IntegrationDisabledAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=108, name="INTEGRATION_DISABLED", api_name="integration.disable")

    def render(self, audit_log_entry: AuditLogEntry):
        provider = audit_log_entry.data.get("provider") or ""
        return f"disabled {provider} integration".format(**audit_log_entry.data)


class IntegrationUpgradeAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=109, name="INTEGRATION_UPGRADE", api_name="integration.upgrade")

    def render(self, audit_log_entry: AuditLogEntry):
        if audit_log_entry.data.get("provider"):
            return "upgraded {name} for the {provider} integration".format(**audit_log_entry.data)
        return "updated an integration"


class IntegrationAddAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=110, name="INTEGRATION_ADD", api_name="integration.add")

    def render(self, audit_log_entry: AuditLogEntry):
        if audit_log_entry.data.get("provider"):
            return "installed {name} for the {provider} integration".format(**audit_log_entry.data)
        return "enabled integration {integration} for project {project}".format(
            **audit_log_entry.data
        )


class IntegrationEditAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=111, name="INTEGRATION_EDIT", api_name="integration.edit")

    def render(self, audit_log_entry: AuditLogEntry):
        if audit_log_entry.data.get("provider"):
            return "edited the {name} for the {provider} integration".format(**audit_log_entry.data)
        return "edited integration {integration} for project {project}".format(
            **audit_log_entry.data
        )


class IntegrationRemoveAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=112, name="INTEGRATION_REMOVE", api_name="integration.remove")

    def render(self, audit_log_entry: AuditLogEntry):
        if audit_log_entry.data.get("provider"):
            return "uninstalled {name} for the {provider} integration".format(
                **audit_log_entry.data
            )
        return "disabled integration {integration} from project {project}".format(
            **audit_log_entry.data
        )


class InternalIntegrationAddAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(
            event_id=130, name="INTERNAL_INTEGRATION_ADD", api_name="internal-integration.create"
        )

    def render(self, audit_log_entry: AuditLogEntry):
        integration_name = audit_log_entry.data.get("name") or ""
        return f"created internal integration {integration_name}"


class InternalIntegrationDisabledAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(
            event_id=131,
            name="INTERNAL_INTEGRATION_DISABLED",
            api_name="internal-integration.disable",
        )

    def render(self, audit_log_entry: AuditLogEntry):
        integration_name = audit_log_entry.data.get("name") or ""
        return f"disabled internal integration {integration_name}".format(**audit_log_entry.data)


class DataSecrecyWaivedAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(
            event_id=1141,
            name="DATA_SECRECY_WAIVED",
            api_name="data-secrecy.waived",
        )

    def render(self, audit_log_entry: AuditLogEntry):
        entry_data = audit_log_entry.data
        access_start = entry_data.get("access_start")
        access_end = entry_data.get("access_end")

        rendered_text = "waived data secrecy"
        if access_start is not None and access_end is not None:
            start_dt = datetime.fromisoformat(access_start)
            end_dt = datetime.fromisoformat(access_end)

            formatted_start = start_dt.strftime("%b %d, %Y %I:%M %p UTC")
            formatted_end = end_dt.strftime("%b %d, %Y %I:%M %p UTC")

            rendered_text += f" from {formatted_start} to {formatted_end}"

        return rendered_text


class MonitorAddAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(
            event_id=120,
            name="MONITOR_ADD",
            api_name="monitor.add",
        )

    def render(self, audit_log_entry: AuditLogEntry):
        entry_data = audit_log_entry.data
        name = entry_data.get("name")
        upsert = entry_data.get("upsert")

        return f"added{" upsert " if upsert else " "}monitor {name}"
