from sentry.models.auditlogentry import AuditLogEntry
from sentry.utils.strings import truncatechars

from .manager import AuditLogEvent, AuditLogEventManager

default_manager = AuditLogEventManager()

# Cannot use the following as an event_id:
# 90, 91, 92, 93, 150, 151, and 152
# These were used for `AuditLogEvent` instances moved to getsentry.

# Render functions for AuditLogEvent objects take an AuditLogEntry and
# return a string of the expected audit log message.
# Use a lambda function in `default_amanger.add()` if only a single string
# with variables is necessary.


def render_member_add(audit_log_entry: AuditLogEntry):
    if audit_log_entry.target_user == audit_log_entry.actor:
        return "joined the organization"

    return f"add member {audit_log_entry.target_user.get_display_name()}"


def render_member_edit(audit_log_entry: AuditLogEntry):
    member = audit_log_entry.data.get("email") or audit_log_entry.target_user.get_display_name()
    role = audit_log_entry.data.get("role") or "N/A"

    if "team_slugs" in audit_log_entry.data:
        teams = ", ".join(str(x) for x in audit_log_entry.data.get("team_slugs", []))
    else:
        teams = "N/A"

    return f"edited member {member} (role: {role}, teams: {teams})"


def render_member_remove(audit_log_entry: AuditLogEntry):
    if audit_log_entry.target_user == audit_log_entry.actor:
        return "left the organization"

    member = audit_log_entry.data.get("email") or audit_log_entry.target_user.get_display_name()

    return f"removed member {member}"


def render_member_join_team(audit_log_entry: AuditLogEntry):
    if audit_log_entry.target_user == audit_log_entry.actor:
        return "joined team {team_slug}".format(**audit_log_entry.data)

    user_display_name = (
        audit_log_entry.data.get("email") or audit_log_entry.target_user.get_display_name()
    )
    return "added {} to team {team_slug}".format(user_display_name, **audit_log_entry.data)


def render_member_leave_team(audit_log_entry: AuditLogEntry):
    if audit_log_entry.target_user == audit_log_entry.actor:
        return "left team {team_slug}".format(**audit_log_entry.data)

    user_display_name = (
        audit_log_entry.data.get("email") or audit_log_entry.target_user.get_display_name()
    )
    return "removed {} from team {team_slug}".format(user_display_name, **audit_log_entry.data)


def render_member_pending(audit_log_entry: AuditLogEntry):
    user_display_name = (
        audit_log_entry.data.get("email") or audit_log_entry.target_user.get_display_name()
    )
    return f"required member {user_display_name} to setup 2FA"


def render_org_edit(audit_log_entry: AuditLogEntry):
    items_string = ", ".join(f"{k} {v}" for k, v in audit_log_entry.data.items())
    return "edited the organization setting: " + items_string


def render_project_edit(audit_log_entry: AuditLogEntry):
    if "old_slug" in audit_log_entry.data:
        return (
            "renamed project slug from "
            + audit_log_entry.data["old_slug"]
            + " to "
            + audit_log_entry.data["new_slug"]
        )
    items_string = " ".join(f"in {key} to {value}" for (key, value) in audit_log_entry.data.items())
    return "edited project settings " + items_string


def render_project_enable(audit_log_entry: AuditLogEntry):
    # Most logs will just be name of the filter, but legacy browser changes can be bool, str or sets
    filter_name = audit_log_entry.data["state"]
    if filter_name in ("0", "1") or isinstance(filter_name, set) or isinstance(filter_name, bool):
        message = "enabled project filter legacy-browsers"
        if isinstance(filter_name, set):
            message += ": {}".format(", ".join(filter_name))
        return message
    return f"enabled project filter {filter_name}"


def render_project_disable(audit_log_entry: AuditLogEntry):
    # Most logs will just be name of the filter, but legacy browser changes can be bool, str or sets
    filter_name = audit_log_entry.data["state"]
    if filter_name in ("0", "1") or isinstance(filter_name, set) or isinstance(filter_name, bool):
        message = "disabled project filter legacy-browsers"
        if isinstance(filter_name, set):
            message += ": {}".format(", ".join(filter_name))
        return message
    return f"disabled project filter {filter_name}"


def render_sso_edit(audit_log_entry: AuditLogEntry):
    settings = ", ".join(f"{k} {v}" for k, v in audit_log_entry.data.items())
    return "edited sso settings: " + settings


def render_servicehook_add(audit_log_entry: AuditLogEntry):
    full_url = audit_log_entry.data.get("url")
    return f'added a service hook for "{truncatechars(full_url, 64)}"'


def render_servicehook_edit(audit_log_entry: AuditLogEntry):
    full_url = audit_log_entry.data.get("url")
    return f'edited the service hook for "{truncatechars(full_url, 64)}"'


def render_servicehook_remove(audit_log_entry: AuditLogEntry):
    full_url = audit_log_entry.data.get("url")
    return f'removed the service hook for "{truncatechars(full_url, 64)}"'


def render_integration_upgrade(audit_log_entry: AuditLogEntry):
    if audit_log_entry.data.get("provider"):
        return "upgraded {name} for the {provider} integration".format(**audit_log_entry.data)
    return "updated an integration"


def render_integration_add(audit_log_entry: AuditLogEntry):
    if audit_log_entry.data.get("provider"):
        return "installed {name} for the {provider} integration".format(**audit_log_entry.data)
    return "enabled integration {integration} for project {project}".format(**audit_log_entry.data)


def render_integration_edit(audit_log_entry: AuditLogEntry):
    if audit_log_entry.data.get("provider"):
        return "edited the {name} for the {provider} integration".format(**audit_log_entry.data)
    return "edited integration {integration} for project {project}".format(**audit_log_entry.data)


def render_integration_remove(audit_log_entry: AuditLogEntry):
    if audit_log_entry.data.get("provider"):
        return "uninstalled {name} for the {provider} integration".format(**audit_log_entry.data)
    return "disabled integration {integration} from project {project}".format(
        **audit_log_entry.data
    )


def render_internal_integration_add(audit_log_entry: AuditLogEntry):
    integration_name = audit_log_entry.data.get("name") or ""
    return f"created internal integration {integration_name}"


# Register the AuditLogEvent objects to the `default_manager`
default_manager.add(
    AuditLogEvent(
        event_id=1,
        name="member_invite",
        api_name="member.invite",
        render=lambda audit_log_entry: "invited member {email}".format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(event_id=2, name="member_add", api_name="member.add", render=render_member_add)
)
default_manager.add(
    AuditLogEvent(
        event_id=3,
        name="member_accept",
        api_name="member.accept-invite",
        render=lambda audit_log_entry: "accepted the membership invite",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=4,
        name="member_edit",
        api_name="member.edit",
        render=render_member_edit,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=5,
        name="member_remove",
        api_name="member.remove",
        render=render_member_remove,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=6,
        name="member_join_team",
        api_name="member.join-team",
        render=render_member_join_team,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=7,
        name="member_leave_team",
        api_name="member.leave-team",
        render=render_member_leave_team,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=8,
        name="member_pending",
        api_name="member.pending",
        render=render_member_pending,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=10,
        name="org_add",
        api_name="org.create",
        render=lambda audit_log_entry: "created the organization",
    )
)
default_manager.add(
    AuditLogEvent(event_id=11, name="org_edit", api_name="org.edit", render=render_org_edit)
)
default_manager.add(
    AuditLogEvent(
        event_id=12,
        name="org_remove",
        api_name="org.remove",
        render=lambda audit_log_entry: "removed the organization",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=13,
        name="org_restore",
        api_name="org.restore",
        render=lambda audit_log_entry: "restored the organization",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=20,
        name="team_add",
        api_name="team.create",
        render=lambda audit_log_entry: "created team {slug}".format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=21,
        name="team_edit",
        api_name="team.edit",
        render=lambda audit_log_entry: "edited team {slug}".format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=22,
        name="team_remove",
        api_name="team.remove",
        render=lambda audit_log_entry: "removed team {slug}".format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=30,
        name="project_add",
        api_name="project.create",
        render=lambda audit_log_entry: "created project {slug}".format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=31, name="project_edit", api_name="project.edit", render=render_project_edit
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=32,
        name="project_remove",
        api_name="project.remove",
        render=lambda audit_log_entry: "removed project {slug}".format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=35,
        name="project_request_transfer",
        api_name="project.request-transfer",
        render=lambda audit_log_entry: "requested to transfer project {slug}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=36,
        name="project_accept_transfer",
        api_name="project.accept-transfer",
        render=lambda audit_log_entry: "accepted transfer of project {slug}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=37, name="project_enable", api_name="project.enable", render=render_project_enable
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=38,
        name="project_disable",
        api_name="project.disable",
        render=render_project_disable,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=40,
        name="tagkey_remove",
        api_name="tagkey.remove",
        render=lambda audit_log_entry: "removed tags matching {key} = *".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=50,
        name="projectkey_add",
        api_name="projectkey.create",
        render=lambda audit_log_entry: "added project key {public_key}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=51,
        name="projectkey_edit",
        api_name="projectkey.edit",
        render=lambda audit_log_entry: "edited project key {public_key}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=52,
        name="projectkey_remove",
        api_name="projectkey.remove",
        render=lambda audit_log_entry: "removed project key {public_key}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=53,
        name="projectkey_change",
        api_name="projectkey.change",
        render=lambda audit_log_entry: "{change} project key {public_key}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=60,
        name="sso_enable",
        api_name="sso.enable",
        render=lambda audit_log_entry: "enabled sso ({provider})".format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=61,
        name="sso_disable",
        api_name="sso.disable",
        render=lambda audit_log_entry: "disabled sso ({provider})".format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(event_id=62, name="sso_edit", api_name="sso.edit", render=render_sso_edit)
)
default_manager.add(
    AuditLogEvent(
        event_id=63,
        name="sso_identity_link",
        api_name="sso-identity.link",
        render=lambda audit_log_entry: "linked their account to a new identity",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=70,
        name="apikey_add",
        api_name="api-key.create",
        render=lambda audit_log_entry: "added api key {label}".format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=71,
        name="apikey_edit",
        api_name="api-key.edit",
        render=lambda audit_log_entry: "edited api key {label}".format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=72,
        name="apikey_remove",
        api_name="api-key.remove",
        render=lambda audit_log_entry: "removed api key {label}".format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=80,
        name="rule_add",
        api_name="rule.create",
        render=lambda audit_log_entry: 'added rule "{label}"'.format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=81,
        name="rule_edit",
        api_name="rule.edit",
        render=lambda audit_log_entry: 'edited rule "{label}"'.format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=82,
        name="rule_remove",
        api_name="rule.remove",
        render=lambda audit_log_entry: 'removed rule "{label}"'.format(**audit_log_entry.data),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=100,
        name="servicehook_add",
        api_name="servicehook.create",
        render=render_servicehook_add,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=101,
        name="servicehook_edit",
        api_name="servicehook.edit",
        render=render_servicehook_edit,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=102,
        name="servicehook_remove",
        api_name="servicehook.remove",
        render=render_servicehook_remove,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=109,
        name="integration_upgrade",
        api_name="integration.upgrade",
        render=render_integration_upgrade,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=110,
        name="integration_add",
        api_name="integration.add",
        render=render_integration_add,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=111,
        name="integration_edit",
        api_name="integration.edit",
        render=render_integration_edit,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=112,
        name="integration_remove",
        api_name="integration.remove",
        render=render_integration_remove,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=113,
        name="sentry_app_add",
        api_name="sentry-app.add",
        render=lambda audit_log_entry: "created sentry app {sentry_app}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=115,
        name="sentry_app_remove",
        api_name="sentry-app.remove",
        render=lambda audit_log_entry: "removed sentry app {sentry_app}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=116,
        name="sentry_app_install",
        api_name="sentry-app.install",
        render=lambda audit_log_entry: "installed sentry app {sentry_app}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=117,
        name="sentry_app_uninstall",
        api_name="sentry-app.uninstall",
        render=lambda audit_log_entry: "uninstalled sentry app {sentry_app}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=130,
        name="internal_integration_add",
        api_name="internal-integration.create",
        render=render_internal_integration_add,
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=135,
        name="internal_integration_add_token",
        api_name="internal-integration.add-token",
        render=lambda audit_log_entry: "created a token for internal integration {sentry_app}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=136,
        name="internal_integration_remove_token",
        api_name="internal-integration.remove-token",
        render=lambda audit_log_entry: "revoked a token for internal integration {sentry_app}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=140,
        name="invite_request_add",
        api_name="invite-request.create",
        render=lambda audit_log_entry: "request added to invite {email}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=141,
        name="invite_request_remove",
        api_name="invite-request.remove",
        render=lambda audit_log_entry: "removed the invite request for {email}".format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=160,
        name="alert_rule_add",
        api_name="alertrule.create",
        render=lambda audit_log_entry: 'added metric alert rule "{label}"'.format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=161,
        name="alert_rule_edit",
        api_name="alertrule.edit",
        render=lambda audit_log_entry: 'edited metric alert rule "{label}"'.format(
            **audit_log_entry.data
        ),
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=162,
        name="alert_rule_remove",
        api_name="alertrule.remove",
        render=lambda audit_log_entry: 'removed metric alert rule "{label}"'.format(
            **audit_log_entry.data
        ),
    )
)
