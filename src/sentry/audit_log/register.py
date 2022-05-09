from sentry.audit_log import events
from sentry.audit_log.manager import AuditLogEvent, AuditLogEventManager

default_manager = AuditLogEventManager()

# Register the AuditLogEvent objects to the `default_manager`
default_manager.add(
    AuditLogEvent(
        event_id=1,
        name="MEMBER_INVITE",
        api_name="member.invite",
        template="invited member {email}",
    )
)
default_manager.add(events.MemberAddAuditLogEvent())
default_manager.add(
    AuditLogEvent(
        event_id=3,
        name="MEMBER_ACCEPT",
        api_name="member.accept-invite",
        template="accepted the membership invite",
    )
)
default_manager.add(events.MemberEditAuditLogEvent())
default_manager.add(events.MemberRemoveAuditLogEvent())
default_manager.add(events.MemberJoinTeamAuditLogEvent())
default_manager.add(events.MemberLeaveTeamAuditLogEvent())
default_manager.add(events.MemberPendingAuditLogEvent())
default_manager.add(
    AuditLogEvent(
        event_id=10, name="ORG_ADD", api_name="org.create", template="created the organization"
    )
)
default_manager.add(events.OrgEditAuditLogEvent())
default_manager.add(
    AuditLogEvent(
        event_id=12, name="ORG_REMOVE", api_name="org.remove", template="removed the organization"
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=13,
        name="ORG_RESTORE",
        api_name="org.restore",
        template="restored the organization",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=20, name="TEAM_ADD", api_name="team.create", template="created team {slug}"
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=21, name="TEAM_EDIT", api_name="team.edit", template="edited team {slug}"
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=22, name="TEAM_REMOVE", api_name="team.remove", template="removed team {slug}"
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=30,
        name="PROJECT_ADD",
        api_name="project.create",
        template="created project {slug}",
    )
)
default_manager.add(events.ProjectEditAuditLogEvent())
default_manager.add(
    AuditLogEvent(
        event_id=32,
        name="PROJECT_REMOVE",
        api_name="project.remove",
        template="removed project {slug}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=35,
        name="PROJECT_REQUEST_TRANSFER",
        api_name="project.request-transfer",
        template="requested to transfer project {slug}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=36,
        name="PROJECT_ACCEPT_TRANSFER",
        api_name="project.accept-transfer",
        template="accepted transfer of project {slug}",
    )
)
default_manager.add(events.ProjectEnableAuditLogEvent())
default_manager.add(events.ProjectDisableAuditLogEvent())
default_manager.add(
    AuditLogEvent(
        event_id=40,
        name="TAGKEY_REMOVE",
        api_name="tagkey.remove",
        template="removed tags matching {key} = *",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=50,
        name="PROJECTKEY_ADD",
        api_name="projectkey.create",
        template="added project key {public_key}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=51,
        name="PROJECTKEY_EDIT",
        api_name="projectkey.edit",
        template="edited project key {public_key}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=52,
        name="PROJECTKEY_REMOVE",
        api_name="projectkey.remove",
        template="removed project key {public_key}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=53,
        name="PROJECTKEY_CHANGE",
        api_name="projectkey.change",
        template="edited project key {public_key}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=60, name="SSO_ENABLE", api_name="sso.enable", template="enabled sso ({provider})"
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=61,
        name="SSO_DISABLE",
        api_name="sso.disable",
        template="disabled sso ({provider})",
    )
)
default_manager.add(events.SSOEditAuditLogEvent())
default_manager.add(
    AuditLogEvent(
        event_id=63,
        name="SSO_IDENTITY_LINK",
        api_name="sso-identity.link",
        template="linked their account to a new identity",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=70, name="APIKEY_ADD", api_name="api-key.create", template="added api key {label}"
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=71, name="APIKEY_EDIT", api_name="api-key.edit", template="edited api key {label}"
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=72,
        name="APIKEY_REMOVE",
        api_name="api-key.remove",
        template="removed api key {label}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=80, name="RULE_ADD", api_name="rule.create", template='added rule "{label}"'
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=81, name="RULE_EDIT", api_name="rule.edit", template='edited rule "{label}"'
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=82, name="RULE_REMOVE", api_name="rule.remove", template='removed rule "{label}"'
    )
)
default_manager.add(events.ServiceHookAddAuditLogEvent())
default_manager.add(events.ServiceHookEditAuditLogEvent())
default_manager.add(events.ServiceHookRemoveAuditLogEvent())
default_manager.add(events.IntegrationUpgradeAuditLogEvent())
default_manager.add(events.IntegrationAddAuditLogEvent())
default_manager.add(events.IntegrationEditAuditLogEvent())
default_manager.add(events.IntegrationRemoveAuditLogEvent())
default_manager.add(
    AuditLogEvent(
        event_id=113,
        name="SENTRY_APP_ADD",
        api_name="sentry-app.add",
        template="created sentry app {sentry_app}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=115,
        name="SENTRY_APP_REMOVE",
        api_name="sentry-app.remove",
        template="removed sentry app {sentry_app}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=116,
        name="SENTRY_APP_INSTALL",
        api_name="sentry-app.install",
        template="installed sentry app {sentry_app}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=117,
        name="SENTRY_APP_UNINSTALL",
        api_name="sentry-app.uninstall",
        template="uninstalled sentry app {sentry_app}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=120, name="MONITOR_ADD", api_name="monitor.add", template="Monitor added"
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=121, name="MONITOR_EDIT", api_name="monitor.edit", template="Monitor edited"
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=122, name="MONITOR_REMOVE", api_name="monitor.remove", template="Monitor removed"
    )
)
default_manager.add(events.InternalIntegrationAddAuditLogEvent())
default_manager.add(
    AuditLogEvent(
        event_id=135,
        name="INTERNAL_INTEGRATION_ADD_TOKEN",
        api_name="internal-integration.add-token",
        template="created a token for internal integration {sentry_app}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=136,
        name="INTERNAL_INTEGRATION_REMOVE_TOKEN",
        api_name="internal-integration.remove-token",
        template="revoked a token for internal integration {sentry_app}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=140,
        name="INVITE_REQUEST_ADD",
        api_name="invite-request.create",
        template="request added to invite {email}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=141,
        name="INVITE_REQUEST_REMOVE",
        api_name="invite-request.remove",
        template="removed the invite request for {email}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=160,
        name="ALERT_RULE_ADD",
        api_name="alertrule.create",
        template='added metric alert rule "{label}"',
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=161,
        name="ALERT_RULE_EDIT",
        api_name="alertrule.edit",
        template='edited metric alert rule "{label}"',
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=162,
        name="ALERT_RULE_REMOVE",
        api_name="alertrule.remove",
        template='removed metric alert rule "{label}"',
    )
)
