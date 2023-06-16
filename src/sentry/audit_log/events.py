from sentry.audit_log.manager import AuditLogEvent
from sentry.models import AuditLogEntry
from sentry.utils.strings import truncatechars

# AuditLogEvents with custom render functions


class MemberAddAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=2, name="MEMBER_ADD", api_name="member.add")

    def render(self, audit_log_entry: AuditLogEntry):
        if audit_log_entry.target_user == audit_log_entry.actor:
            return "joined the organization"
        return f"add member {audit_log_entry.target_user.get_display_name()}"


class MemberEditAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=4, name="MEMBER_EDIT", api_name="member.edit")

    def render(self, audit_log_entry: AuditLogEntry):
        member = audit_log_entry.data.get("email") or audit_log_entry.target_user.get_display_name()
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

        member = audit_log_entry.data.get("email") or audit_log_entry.target_user.get_display_name()
        return f"removed member {member}"


class MemberJoinTeamAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=6, name="MEMBER_JOIN_TEAM", api_name="member.join-team")

    def render(self, audit_log_entry: AuditLogEntry):
        if audit_log_entry.target_user == audit_log_entry.actor:
            return "joined team {team_slug}".format(**audit_log_entry.data)

        user_display_name = (
            audit_log_entry.data.get("email") or audit_log_entry.target_user.get_display_name()
        )
        return "added {} to team {team_slug}".format(user_display_name, **audit_log_entry.data)


class MemberLeaveTeamAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=7, name="MEMBER_LEAVE_TEAM", api_name="member.leave-team")

    def render(self, audit_log_entry: AuditLogEntry):
        if audit_log_entry.target_user == audit_log_entry.actor:
            return "left team {team_slug}".format(**audit_log_entry.data)

        user_display_name = (
            audit_log_entry.data.get("email") or audit_log_entry.target_user.get_display_name()
        )
        return "removed {} from team {team_slug}".format(user_display_name, **audit_log_entry.data)


class MemberPendingAuditLogEvent(AuditLogEvent):
    def __init__(self):
        super().__init__(event_id=8, name="MEMBER_PENDING", api_name="member.pending")

    def render(self, audit_log_entry: AuditLogEntry):
        user_display_name = (
            audit_log_entry.data.get("email") or audit_log_entry.target_user.get_display_name()
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
        old_org_role = audit_log_entry.data.get("old_org_role")
        new_org_role = audit_log_entry.data.get("org_role")
        slug = audit_log_entry.data["slug"]

        if old_org_role != new_org_role:
            return f"edited team {slug}'s org role to {new_org_role}"
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


def render_project_action(audit_log_entry: AuditLogEntry, action: str):
    # Most logs will just be name of the filter, but legacy browser changes can be bool, str, list, or sets
    filter_name = audit_log_entry.data["state"]
    if filter_name in ("0", "1") or isinstance(filter_name, (bool, list, set)):
        message = f"{action} project filter legacy-browsers"
        if isinstance(filter_name, (list, set)):
            message += ": {}".format(", ".join(sorted(filter_name)))
        return message
    return f"{action} project filter {filter_name}"


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
