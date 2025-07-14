from typing import TYPE_CHECKING

from sentry.audit_log.manager import AuditLogEvent, AuditLogEventManager
from sentry.utils.strings import truncatechars

if TYPE_CHECKING:
    from sentry.models.auditlogentry import AuditLogEntry
    from sentry.users.models.user import User


def _get_member_display(email: str | None, target_user: User | None) -> str:
    if email is not None:
        return email
    elif target_user is not None:
        return target_user.get_display_name()
    else:
        return "(unknown member)"


default_manager = AuditLogEventManager()

add = default_manager.add
add_with_render_func = default_manager.add_with_render_func

# Register the AuditLogEvent objects to the `default_manager`
add(
    AuditLogEvent(
        event_id=1,
        name="MEMBER_INVITE",
        api_name="member.invite",
        template="invited member {email}",
    )
)


@add_with_render_func(AuditLogEvent(event_id=2, name="MEMBER_ADD", api_name="member.add"))
def render_member_add(audit_log_entry: AuditLogEntry):
    if audit_log_entry.target_user == audit_log_entry.actor:
        return "joined the organization"

    member = _get_member_display(audit_log_entry.data.get("email"), audit_log_entry.target_user)
    return f"add member {member}"


add(
    AuditLogEvent(
        event_id=3,
        name="MEMBER_ACCEPT",
        api_name="member.accept-invite",
        template="accepted the membership invite",
    )
)


@add_with_render_func(AuditLogEvent(event_id=4, name="MEMBER_EDIT", api_name="member.edit"))
def render_member_edit(audit_log_entry: AuditLogEntry):
    member = _get_member_display(audit_log_entry.data.get("email"), audit_log_entry.target_user)
    role = audit_log_entry.data.get("role") or "N/A"

    if "team_slugs" in audit_log_entry.data:
        teams = ", ".join(str(x) for x in audit_log_entry.data.get("team_slugs", []))
    else:
        teams = "N/A"
    return f"edited member {member} (role: {role}, teams: {teams})"


@add_with_render_func(AuditLogEvent(event_id=5, name="MEMBER_REMOVE", api_name="member.remove"))
def render_member_remove(audit_log_entry: AuditLogEntry):
    if audit_log_entry.target_user == audit_log_entry.actor:
        return "left the organization"

    member = _get_member_display(audit_log_entry.data.get("email"), audit_log_entry.target_user)
    return f"removed member {member}"


@add_with_render_func(
    AuditLogEvent(event_id=6, name="MEMBER_JOIN_TEAM", api_name="member.join-team")
)
def render_member_join_team(audit_log_entry: AuditLogEntry):
    if audit_log_entry.target_user == audit_log_entry.actor:
        return "joined team {team_slug}".format(**audit_log_entry.data)

    user_display_name = _get_member_display(
        audit_log_entry.data.get("email"), audit_log_entry.target_user
    )
    return "added {} to team {team_slug}".format(user_display_name, **audit_log_entry.data)


@add_with_render_func(
    AuditLogEvent(event_id=7, name="MEMBER_LEAVE_TEAM", api_name="member.leave-team")
)
def render_member_leave_team(audit_log_entry: AuditLogEntry):
    if audit_log_entry.target_user == audit_log_entry.actor:
        return "left team {team_slug}".format(**audit_log_entry.data)

    user_display_name = _get_member_display(
        audit_log_entry.data.get("email"), audit_log_entry.target_user
    )
    return "removed {} from team {team_slug}".format(user_display_name, **audit_log_entry.data)


@add_with_render_func(AuditLogEvent(event_id=8, name="MEMBER_PENDING", api_name="member.pending"))
def render_member_pending(audit_log_entry: AuditLogEntry):
    user_display_name = _get_member_display(
        audit_log_entry.data.get("email"), audit_log_entry.target_user
    )
    return f"required member {user_display_name} to setup 2FA"


@add_with_render_func(AuditLogEvent(event_id=10, name="ORG_ADD", api_name="org.create"))
def render_org_add(audit_log_entry: AuditLogEntry):
    if channel := audit_log_entry.data.get("channel"):
        return f"created the organization with {channel} integration"
    return "created the organization"


@add_with_render_func(AuditLogEvent(event_id=11, name="ORG_EDIT", api_name="org.edit"))
def render_org_edit(audit_log_entry: AuditLogEntry):
    items_string = ", ".join(f"{k} {v}" for k, v in audit_log_entry.data.items())
    return "edited the organization setting: " + items_string


add(
    AuditLogEvent(
        event_id=12,
        name="ORG_REMOVE",
        api_name="org.remove",
        template="removed the organization",
    )
)
add(
    AuditLogEvent(
        event_id=13,
        name="ORG_RESTORE",
        api_name="org.restore",
        template="restored the organization",
    )
)
add(
    AuditLogEvent(
        event_id=20,
        name="TEAM_ADD",
        api_name="team.create",
        template="created team {slug}",
    )
)
add(
    AuditLogEvent(
        event_id=21,
        name="TEAM_EDIT",
        api_name="team.edit",
        template="edited team {slug}",
    )
)
add(
    AuditLogEvent(
        event_id=22,
        name="TEAM_REMOVE",
        api_name="team.remove",
        template="removed team {slug}",
    )
)
add(
    AuditLogEvent(
        event_id=30,
        name="PROJECT_ADD",
        api_name="project.create",
        template="created project {slug}",
    )
)


@add_with_render_func(
    AuditLogEvent(
        event_id=31,
        name="PROJECT_EDIT",
        api_name="project.edit",
    )
)
def render_project_edit(audit_log_entry: AuditLogEntry):
    if "old_slug" in audit_log_entry.data:
        return "renamed project slug from {old_slug} to {new_slug}".format(**audit_log_entry.data)
    items_string = " ".join(f"in {key} to {value}" for (key, value) in audit_log_entry.data.items())
    return "edited project settings " + items_string


@add_with_render_func(
    AuditLogEvent(
        event_id=178,
        name="PROJECT_PERFORMANCE_ISSUE_DETECTION_CHANGE",
        api_name="project.change-performance-issue-detection",
    )
)
def render_project_performance_issue_detection_change(audit_log_entry: AuditLogEntry):
    from sentry.api.endpoints.project_performance_issue_settings import (
        project_settings_to_group_map as map,
    )

    data = audit_log_entry.data
    items_string = ", ".join(
        f"to {'enable' if value else 'disable'} detection of {map[key].description} issue"
        for (key, value) in data.items()
        if key in map.keys()
    )
    return "edited project performance issue detector settings " + items_string


add(
    AuditLogEvent(
        event_id=32,
        name="PROJECT_REMOVE",
        api_name="project.remove",
        template="removed project {slug}",
    )
)
add(
    AuditLogEvent(
        event_id=33,
        name="PROJECT_REMOVE_WITH_ORIGIN",
        api_name="project.remove-with-origin",
        template="removed project {slug} in {origin}",
    )
)
add(
    AuditLogEvent(
        event_id=35,
        name="PROJECT_REQUEST_TRANSFER",
        api_name="project.request-transfer",
        template="requested to transfer project {slug}",
    )
)
add(
    AuditLogEvent(
        event_id=36,
        name="PROJECT_ACCEPT_TRANSFER",
        api_name="project.accept-transfer",
        template="accepted transfer of project {project_slug} from {old_organization_slug} to {new_organization_slug}",
    )
)


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


@add_with_render_func(AuditLogEvent(event_id=37, name="PROJECT_ENABLE", api_name="project.enable"))
def render_project_enable(audit_log_entry: AuditLogEntry):
    return render_project_action(audit_log_entry, "enable")


@add_with_render_func(
    AuditLogEvent(
        event_id=38,
        name="PROJECT_DISABLE",
        api_name="project.disable",
    )
)
def render_project_enable_disable(audit_log_entry: AuditLogEntry):
    return render_project_action(audit_log_entry, "disable")


add(
    AuditLogEvent(
        event_id=40,
        name="TAGKEY_REMOVE",
        api_name="tagkey.remove",
        template="removed tags matching {key} = *",
    )
)
add(
    AuditLogEvent(
        event_id=50,
        name="PROJECTKEY_ADD",
        api_name="projectkey.create",
        template="added project key {public_key}",
    )
)


@add_with_render_func(
    AuditLogEvent(event_id=51, name="PROJECTKEY_EDIT", api_name="projectkey.edit")
)
def render_project_key_edit(audit_log_entry: AuditLogEntry):
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


add(
    AuditLogEvent(
        event_id=52,
        name="PROJECTKEY_REMOVE",
        api_name="projectkey.remove",
        template="removed project key {public_key}",
    )
)
add(
    AuditLogEvent(
        event_id=53,
        name="PROJECTKEY_CHANGE",
        api_name="projectkey.change",
        template="edited project key {public_key}",
    )
)
add(
    AuditLogEvent(
        event_id=60,
        name="SSO_ENABLE",
        api_name="sso.enable",
        template="enabled sso ({provider})",
    )
)
add(
    AuditLogEvent(
        event_id=61,
        name="SSO_DISABLE",
        api_name="sso.disable",
        template="disabled sso ({provider})",
    )
)


@add_with_render_func(AuditLogEvent(event_id=62, name="SSO_EDIT", api_name="sso.edit"))
def render_sso_edit(audit_log_entry: AuditLogEntry):
    settings = ", ".join(f"{k} {v}" for k, v in audit_log_entry.data.items())
    return "edited sso settings: " + settings


add(
    AuditLogEvent(
        event_id=63,
        name="SSO_IDENTITY_LINK",
        api_name="sso-identity.link",
        template="linked their account to a new identity",
    )
)
add(
    AuditLogEvent(
        event_id=70,
        name="APIKEY_ADD",
        api_name="api-key.create",
        template="added api key {label}",
    )
)
add(
    AuditLogEvent(
        event_id=71,
        name="APIKEY_EDIT",
        api_name="api-key.edit",
        template="edited api key {label}",
    )
)
add(
    AuditLogEvent(
        event_id=72,
        name="APIKEY_REMOVE",
        api_name="api-key.remove",
        template="removed api key {label}",
    )
)
add(
    AuditLogEvent(
        event_id=80,
        name="RULE_ADD",
        api_name="rule.create",
        template='added rule "{label}"',
    )
)
add(
    AuditLogEvent(
        event_id=81,
        name="RULE_EDIT",
        api_name="rule.edit",
        template='edited rule "{label}"',
    )
)
add(
    AuditLogEvent(
        event_id=82,
        name="RULE_REMOVE",
        api_name="rule.remove",
        template='removed rule "{label}"',
    )
)
add(
    AuditLogEvent(
        event_id=83,
        name="RULE_SNOOZE",
        api_name="rule.mute",
        template='muted rule "{label}"',
    )
)
add(
    AuditLogEvent(
        event_id=84,
        name="RULE_DISABLE",
        api_name="rule.disable",
        template='disabled rule "{label}"',
    )
)


@add_with_render_func(
    AuditLogEvent(event_id=100, name="SERVICEHOOK_ADD", api_name="servicehook.create")
)
def render_service_hook_add(audit_log_entry: AuditLogEntry):
    full_url = audit_log_entry.data.get("url")
    return f'added a service hook for "{truncatechars(full_url, 64)}"'


@add_with_render_func(
    AuditLogEvent(event_id=101, name="SERVICEHOOK_EDIT", api_name="servicehook.edit")
)
def render_service_hook_edit(audit_log_entry: AuditLogEntry):
    full_url = audit_log_entry.data.get("url")
    return f'edited the service hook for "{truncatechars(full_url, 64)}"'


@add_with_render_func(
    AuditLogEvent(event_id=102, name="SERVICEHOOK_REMOVE", api_name="servicehook.remove")
)
def render_service_hook_remove(audit_log_entry: AuditLogEntry):
    full_url = audit_log_entry.data.get("url")
    return f'removed the service hook for "{truncatechars(full_url, 64)}"'


@add_with_render_func(
    AuditLogEvent(event_id=108, name="INTEGRATION_DISABLED", api_name="integration.disable")
)
def render_integration_disabled(audit_log_entry: AuditLogEntry):
    provider = audit_log_entry.data.get("provider") or ""
    return f"disabled {provider} integration".format(**audit_log_entry.data)


@add_with_render_func(
    AuditLogEvent(event_id=109, name="INTEGRATION_UPGRADE", api_name="integration.upgrade")
)
def render_integration_upgrade(audit_log_entry: AuditLogEntry):
    if audit_log_entry.data.get("provider"):
        return "upgraded {name} for the {provider} integration".format(**audit_log_entry.data)
    return "updated an integration"


@add_with_render_func(
    AuditLogEvent(event_id=110, name="INTEGRATION_ADD", api_name="integration.add")
)
def render_integration_add(audit_log_entry: AuditLogEntry):
    if audit_log_entry.data.get("provider"):
        return "installed {name} for the {provider} integration".format(**audit_log_entry.data)
    return "enabled integration {integration} for project {project}".format(**audit_log_entry.data)


@add_with_render_func(
    AuditLogEvent(event_id=111, name="INTEGRATION_EDIT", api_name="integration.edit")
)
def render_integration_edit(audit_log_entry: AuditLogEntry):
    if audit_log_entry.data.get("provider"):
        return "edited the {name} for the {provider} integration".format(**audit_log_entry.data)
    return "edited integration {integration} for project {project}".format(**audit_log_entry.data)


@add_with_render_func(
    AuditLogEvent(event_id=112, name="INTEGRATION_REMOVE", api_name="integration.remove")
)
def render_integration_remove(audit_log_entry: AuditLogEntry):
    if audit_log_entry.data.get("provider"):
        return "uninstalled {name} for the {provider} integration".format(**audit_log_entry.data)
    return "disabled integration {integration} from project {project}".format(
        **audit_log_entry.data
    )


add(
    AuditLogEvent(
        event_id=113,
        name="SENTRY_APP_ADD",
        api_name="sentry-app.add",
        template="created sentry app {sentry_app}",
    )
)
add(
    AuditLogEvent(
        event_id=115,
        name="SENTRY_APP_REMOVE",
        api_name="sentry-app.remove",
        template="removed sentry app {sentry_app}",
    )
)
add(
    AuditLogEvent(
        event_id=116,
        name="SENTRY_APP_INSTALL",
        api_name="sentry-app.install",
        template="installed sentry app {sentry_app}",
    )
)
add(
    AuditLogEvent(
        event_id=117,
        name="SENTRY_APP_UNINSTALL",
        api_name="sentry-app.uninstall",
        template="uninstalled sentry app {sentry_app}",
    )
)
add(
    AuditLogEvent(
        event_id=118,
        name="INTEGRATION_ROTATE_CLIENT_SECRET",
        api_name="integration.rotate-client-secret",
        template="rotated a client secret for {status} integration {sentry_app}",
    )
)


@add_with_render_func(AuditLogEvent(event_id=120, name="MONITOR_ADD", api_name="monitor.add"))
def render_monitor_add(audit_log_entry: AuditLogEntry):
    entry_data = audit_log_entry.data
    name = entry_data.get("name")
    upsert = entry_data.get("upsert")

    return f"added{" upsert " if upsert else " "}monitor {name}"


add(
    AuditLogEvent(
        event_id=121,
        name="MONITOR_EDIT",
        api_name="monitor.edit",
        template="edited monitor {name}",
    )
)
add(
    AuditLogEvent(
        event_id=122,
        name="MONITOR_REMOVE",
        api_name="monitor.remove",
        template="removed monitor {name}",
    )
)
add(
    AuditLogEvent(
        event_id=123,
        name="MONITOR_ENVIRONMENT_REMOVE",
        api_name="monitor.environment.remove",
        template="removed an environment from monitor {name}",
    )
)
add(
    AuditLogEvent(
        event_id=124,
        name="MONITOR_ENVIRONMENT_EDIT",
        api_name="monitor.environment.edit",
        template="edited an environment from monitor {name}",
    )
)


@add_with_render_func(
    AuditLogEvent(
        event_id=130, name="INTERNAL_INTEGRATION_ADD", api_name="internal-integration.create"
    )
)
def render_internal_integration_add(audit_log_entry: AuditLogEntry):
    integration_name = audit_log_entry.data.get("name") or ""
    return f"created internal integration {integration_name}"


@add_with_render_func(
    AuditLogEvent(
        event_id=131, name="INTERNAL_INTEGRATION_DISABLED", api_name="internal-integration.disable"
    )
)
def render_internal_integration_disabled(audit_log_entry: AuditLogEntry):
    integration_name = audit_log_entry.data.get("name") or ""
    return f"disabled internal integration {integration_name}".format(**audit_log_entry.data)


add(
    AuditLogEvent(
        event_id=135,
        name="INTERNAL_INTEGRATION_ADD_TOKEN",
        api_name="internal-integration.add-token",
        template="created a token for internal integration {sentry_app}",
    )
)
add(
    AuditLogEvent(
        event_id=136,
        name="INTERNAL_INTEGRATION_REMOVE_TOKEN",
        api_name="internal-integration.remove-token",
        template="revoked a token for internal integration {sentry_app}",
    )
)
add(
    AuditLogEvent(
        event_id=140,
        name="INVITE_REQUEST_ADD",
        api_name="invite-request.create",
        template="request added to invite {email}",
    )
)
add(
    AuditLogEvent(
        event_id=141,
        name="INVITE_REQUEST_REMOVE",
        api_name="invite-request.remove",
        template="removed the invite request for {email}",
    )
)
add(
    AuditLogEvent(
        event_id=160,
        name="ALERT_RULE_ADD",
        api_name="alertrule.create",
        template='added metric alert rule "{label}"',
    )
)
add(
    AuditLogEvent(
        event_id=161,
        name="ALERT_RULE_EDIT",
        api_name="alertrule.edit",
        template='edited metric alert rule "{label}"',
    )
)
add(
    AuditLogEvent(
        event_id=162,
        name="ALERT_RULE_REMOVE",
        api_name="alertrule.remove",
        template='removed metric alert rule "{label}"',
    )
)
add(
    AuditLogEvent(
        event_id=168,
        name="ALERT_RULE_SNOOZE",
        api_name="alertrule.mute",
        template='muted metric alert rule "{label}"',
    )
)
add(
    AuditLogEvent(
        event_id=163,
        name="SAMPLING_BIAS_ENABLED",
        api_name="sampling_priority.enabled",
        template='enabled dynamic sampling priority "{name}"',
    )
)
add(
    AuditLogEvent(
        event_id=164,
        name="SAMPLING_BIAS_DISABLED",
        api_name="sampling_priority.disabled",
        template='disabled dynamic sampling priority "{name}"',
    )
)
add(
    AuditLogEvent(
        event_id=165,
        name="NOTIFICATION_ACTION_ADD",
        api_name="notification_action.create",
        template="added an action with the '{trigger}' trigger",
    )
)
add(
    AuditLogEvent(
        event_id=166,
        name="NOTIFICATION_ACTION_EDIT",
        api_name="notification_action.edit",
        template="edited an action with the '{trigger}' trigger",
    )
)
add(
    AuditLogEvent(
        event_id=167,
        name="NOTIFICATION_ACTION_REMOVE",
        api_name="notification_action.remove",
        template="removed an action with the '{trigger}' trigger",
    )
)
add(
    AuditLogEvent(
        event_id=175,
        name="TEAM_AND_PROJECT_CREATED",
        api_name="team-and-project.created",
        template="created team {team_slug} and added user as Team Admin while creating project {project_slug}",
    )
)
add(
    AuditLogEvent(
        event_id=176,
        name="ORGAUTHTOKEN_ADD",
        api_name="org-auth-token.create",
        template="added org auth token {name}",
    )
)
add(
    AuditLogEvent(
        event_id=177,
        name="ORGAUTHTOKEN_REMOVE",
        api_name="org-auth-token.remove",
        template="removed org auth token {name}",
    )
)
add(
    AuditLogEvent(
        event_id=179,
        name="PROJECT_OWNERSHIPRULE_EDIT",
        api_name="project.ownership-rule.edit",
        template="modified ownership rules",
    )
)
add(
    AuditLogEvent(
        event_id=180,
        name="PROJECT_TEAM_REMOVE",
        api_name="project-team.remove",
        template="removed team {team_slug} from project {project_slug}",
    )
)
add(
    AuditLogEvent(
        event_id=181,
        name="PROJECT_TEAM_ADD",
        api_name="project-team.add",
        template="added team {team_slug} to project {project_slug}",
    )
)
add(
    AuditLogEvent(
        event_id=182,
        name="METRIC_BLOCK",
        api_name="metric.block",
        template="blocked metric {metric_mri} for project {project_slug}",
    )
)
add(
    AuditLogEvent(
        event_id=183,
        name="METRIC_TAGS_BLOCK",
        api_name="metric.tags.block",
        template="blocked {tags} tags of metric {metric_mri} for project {project_slug}",
    )
)
add(
    AuditLogEvent(
        event_id=184,
        name="METRIC_UNBLOCK",
        api_name="metric.unblock",
        template="unblocked metric {metric_mri} for project {project_slug}",
    )
)
add(
    AuditLogEvent(
        event_id=185,
        name="METRIC_TAGS_UNBLOCK",
        api_name="metric.tags.unblock",
        template="unblocked {tags} tags of metric {metric_mri} for project {project_slug}",
    )
)
add(
    AuditLogEvent(
        event_id=186,
        name="ISSUE_DELETE",
        api_name="issue.delete",
        template="Deleted issue {issue_id} for project {project_slug}",
    )
)
add(
    AuditLogEvent(
        event_id=187,
        name="SPAN_BASED_METRIC_CREATE",
        api_name="span_extraction_rule_config.create",
        template="Created span-based metric for span attribute {span_attribute} for project {project_slug}",
    )
)

add(
    AuditLogEvent(
        event_id=188,
        name="SPAN_BASED_METRIC_UPDATE",
        api_name="span_extraction_rule_config.update",
        template="Updated span-based metric for span attribute {span_attribute} for project {project_slug}",
    )
)

add(
    AuditLogEvent(
        event_id=189,
        name="SPAN_BASED_METRIC_DELETE",
        api_name="span_extraction_rule_config.delete",
        template="Deleted span-based metric for span attribute {span_attribute} for project {project_slug}",
    )
)

add(
    AuditLogEvent(
        event_id=190,
        name="PROJECT_TEMPLATE_CREATED",
        api_name="project_template.create",
        template="Created project template {name} for organization {organization_id}",
    )
)

add(
    AuditLogEvent(
        event_id=200,
        name="UPTIME_MONITOR_ADD",
        api_name="uptime_monitor.add",
        template="added uptime monitor {name}",
    )
)
add(
    AuditLogEvent(
        event_id=201,
        name="UPTIME_MONITOR_EDIT",
        api_name="uptime_monitor.edit",
        template="edited uptime monitor {name}",
    )
)
add(
    AuditLogEvent(
        event_id=202,
        name="UPTIME_MONITOR_REMOVE",
        api_name="uptime_monitor.remove",
        template="removed uptime monitor {name}",
    )
)
add(
    AuditLogEvent(
        event_id=210,
        name="DETECTOR_ADD",
        api_name="detector.add",
        template="added detector {name}",
    )
)
add(
    AuditLogEvent(
        event_id=211,
        name="DETECTOR_EDIT",
        api_name="detector.edit",
        template="edited detector {name}",
    )
)
add(
    AuditLogEvent(
        event_id=212,
        name="DETECTOR_REMOVE",
        api_name="detector.remove",
        template="removed detector {name}",
    )
)
add(
    AuditLogEvent(
        event_id=213,
        name="WORKFLOW_ADD",
        api_name="workflow.add",
        template="added workflow {name}",
    )
)
add(
    AuditLogEvent(
        event_id=214,
        name="WORKFLOW_EDIT",
        api_name="workflow.edit",
        template="edited workflow {name}",
    )
)
add(
    AuditLogEvent(
        event_id=215,
        name="WORKFLOW_REMOVE",
        api_name="workflow.remove",
        template="removed workflow {name}",
    )
)
add(
    AuditLogEvent(
        event_id=216,
        name="DETECTOR_WORKFLOW_ADD",
        api_name="detector_workflow.add",
        template="connected detector {detector_name} to workflow {workflow_name}",
    )
)
add(
    AuditLogEvent(
        event_id=217,
        name="DETECTOR_WORKFLOW_REMOVE",
        api_name="detector_workflow.remove",
        template="disconnected detector {detector_name} from workflow {workflow_name}",
    )
)

add(
    AuditLogEvent(
        event_id=204,
        name="MEMBER_REINVITE",
        api_name="member.reinvite",
        template="reinvited member {email}",
    )
)

add(
    AuditLogEvent(
        event_id=1152,
        name="TEMPEST_CLIENT_ID_ADD",
        api_name="playstation-client-id.create",
        template="added playstation client id {client_id}",
    )
)
add(
    AuditLogEvent(
        event_id=1153,
        name="TEMPEST_CLIENT_ID_REMOVE",
        api_name="playstation-client-id.remove",
        template="removed playstation client id {client_id}",
    )
)
add(
    AuditLogEvent(
        event_id=1154,
        name="PROJECT_ADD_WITH_ORIGIN",
        api_name="project.create-with-origin",
        template="created project {slug} via {origin}",
    )
)
