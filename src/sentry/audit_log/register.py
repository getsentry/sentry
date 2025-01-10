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
        event_id=10,
        name="ORG_ADD",
        api_name="org.create",
        template="created the organization",
    )
)
default_manager.add(events.OrgEditAuditLogEvent())
default_manager.add(
    AuditLogEvent(
        event_id=12,
        name="ORG_REMOVE",
        api_name="org.remove",
        template="removed the organization",
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
        event_id=20,
        name="TEAM_ADD",
        api_name="team.create",
        template="created team {slug}",
    )
)
default_manager.add(events.TeamEditAuditLogEvent())
default_manager.add(
    AuditLogEvent(
        event_id=22,
        name="TEAM_REMOVE",
        api_name="team.remove",
        template="removed team {slug}",
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
default_manager.add(events.ProjectPerformanceDetectionSettingsAuditLogEvent())
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
        event_id=33,
        name="PROJECT_REMOVE_WITH_ORIGIN",
        api_name="project.remove-with-origin",
        template="removed project {slug} in {origin}",
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
default_manager.add(events.ProjectKeyEditAuditLogEvent())
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
        event_id=60,
        name="SSO_ENABLE",
        api_name="sso.enable",
        template="enabled sso ({provider})",
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
        event_id=70,
        name="APIKEY_ADD",
        api_name="api-key.create",
        template="added api key {label}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=71,
        name="APIKEY_EDIT",
        api_name="api-key.edit",
        template="edited api key {label}",
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
        event_id=80,
        name="RULE_ADD",
        api_name="rule.create",
        template='added rule "{label}"',
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=81,
        name="RULE_EDIT",
        api_name="rule.edit",
        template='edited rule "{label}"',
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=82,
        name="RULE_REMOVE",
        api_name="rule.remove",
        template='removed rule "{label}"',
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=83,
        name="RULE_SNOOZE",
        api_name="rule.mute",
        template='muted rule "{label}"',
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=84,
        name="RULE_DISABLE",
        api_name="rule.disable",
        template='disabled rule "{label}"',
    )
)
default_manager.add(events.ServiceHookAddAuditLogEvent())
default_manager.add(events.ServiceHookEditAuditLogEvent())
default_manager.add(events.ServiceHookRemoveAuditLogEvent())
default_manager.add(events.IntegrationDisabledAuditLogEvent())
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
        event_id=118,
        name="INTEGRATION_ROTATE_CLIENT_SECRET",
        api_name="integration.rotate-client-secret",
        template="rotated a client secret for {status} integration {sentry_app}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=120,
        name="MONITOR_ADD",
        api_name="monitor.add",
        template="added monitor {name}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=121,
        name="MONITOR_EDIT",
        api_name="monitor.edit",
        template="edited monitor {name}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=122,
        name="MONITOR_REMOVE",
        api_name="monitor.remove",
        template="removed monitor {name}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=123,
        name="MONITOR_ENVIRONMENT_REMOVE",
        api_name="monitor.environment.remove",
        template="removed an environment from monitor {name}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=124,
        name="MONITOR_ENVIRONMENT_EDIT",
        api_name="monitor.environment.edit",
        template="edited an environment from monitor {name}",
    )
)
default_manager.add(events.InternalIntegrationAddAuditLogEvent())
default_manager.add(events.InternalIntegrationDisabledAuditLogEvent())
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
default_manager.add(
    AuditLogEvent(
        event_id=168,
        name="ALERT_RULE_SNOOZE",
        api_name="alertrule.mute",
        template='muted metric alert rule "{label}"',
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=163,
        name="SAMPLING_BIAS_ENABLED",
        api_name="sampling_priority.enabled",
        template='enabled dynamic sampling priority "{name}"',
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=164,
        name="SAMPLING_BIAS_DISABLED",
        api_name="sampling_priority.disabled",
        template='disabled dynamic sampling priority "{name}"',
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=165,
        name="NOTIFICATION_ACTION_ADD",
        api_name="notification_action.create",
        template="added an action with the '{trigger}' trigger",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=166,
        name="NOTIFICATION_ACTION_EDIT",
        api_name="notification_action.edit",
        template="edited an action with the '{trigger}' trigger",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=167,
        name="NOTIFICATION_ACTION_REMOVE",
        api_name="notification_action.remove",
        template="removed an action with the '{trigger}' trigger",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=175,
        name="TEAM_AND_PROJECT_CREATED",
        api_name="team-and-project.created",
        template="created team {team_slug} and added user as Team Admin while creating project {project_slug}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=176,
        name="ORGAUTHTOKEN_ADD",
        api_name="org-auth-token.create",
        template="added org auth token {name}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=177,
        name="ORGAUTHTOKEN_REMOVE",
        api_name="org-auth-token.remove",
        template="removed org auth token {name}",
    )
)
default_manager.add(events.ProjectOwnershipRuleEditAuditLogEvent())
default_manager.add(
    AuditLogEvent(
        event_id=180,
        name="PROJECT_TEAM_REMOVE",
        api_name="project-team.remove",
        template="removed team {team_slug} from project {project_slug}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=181,
        name="PROJECT_TEAM_ADD",
        api_name="project-team.add",
        template="added team {team_slug} to project {project_slug}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=182,
        name="METRIC_BLOCK",
        api_name="metric.block",
        template="blocked metric {metric_mri} for project {project_slug}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=183,
        name="METRIC_TAGS_BLOCK",
        api_name="metric.tags.block",
        template="blocked {tags} tags of metric {metric_mri} for project {project_slug}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=184,
        name="METRIC_UNBLOCK",
        api_name="metric.unblock",
        template="unblocked metric {metric_mri} for project {project_slug}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=185,
        name="METRIC_TAGS_UNBLOCK",
        api_name="metric.tags.unblock",
        template="unblocked {tags} tags of metric {metric_mri} for project {project_slug}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=186,
        name="ISSUE_DELETE",
        api_name="issue.delete",
        template="Deleted issue {issue_id} for project {project_slug}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=187,
        name="SPAN_BASED_METRIC_CREATE",
        api_name="span_extraction_rule_config.create",
        template="Created span-based metric for span attribute {span_attribute} for project {project_slug}",
    )
)

default_manager.add(
    AuditLogEvent(
        event_id=188,
        name="SPAN_BASED_METRIC_UPDATE",
        api_name="span_extraction_rule_config.update",
        template="Updated span-based metric for span attribute {span_attribute} for project {project_slug}",
    )
)

default_manager.add(
    AuditLogEvent(
        event_id=189,
        name="SPAN_BASED_METRIC_DELETE",
        api_name="span_extraction_rule_config.delete",
        template="Deleted span-based metric for span attribute {span_attribute} for project {project_slug}",
    )
)

default_manager.add(
    AuditLogEvent(
        event_id=190,
        name="PROJECT_TEMPLATE_CREATED",
        api_name="project_template.create",
        template="Created project template {name} for organization {organization_id}",
    )
)

default_manager.add(
    AuditLogEvent(
        event_id=200,
        name="UPTIME_MONITOR_ADD",
        api_name="uptime_monitor.add",
        template="added uptime monitor {name}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=201,
        name="UPTIME_MONITOR_EDIT",
        api_name="uptime_monitor.edit",
        template="edited uptime monitor {name}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=202,
        name="UPTIME_MONITOR_REMOVE",
        api_name="uptime_monitor.remove",
        template="removed uptime monitor {name}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=210,
        name="WORKFLOW_ENGINE_DETECTOR_ADD",
        api_name="workflow_engine_detector.add",
        template="added workflow engine detector {name}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=211,
        name="WORKFLOW_ENGINE_DETECTOR_EDIT",
        api_name="workflow_engine_detector.edit",
        template="edited workflow engine detector {name}",
    )
)
default_manager.add(
    AuditLogEvent(
        event_id=212,
        name="WORKFLOW_ENGINE_DETECTOR_REMOVE",
        api_name="workflow_engine_detector.remove",
        template="removed workflow engine detector {name}",
    )
)

default_manager.add(
    AuditLogEvent(
        event_id=204,
        name="MEMBER_REINVITE",
        api_name="member.reinvite",
        template="reinvited member {email}",
    )
)

default_manager.add(events.DataSecrecyWaivedAuditLogEvent())

default_manager.add(
    AuditLogEvent(
        event_id=1142,
        name="DATA_SECRECY_REINSTATED",
        api_name="data-secrecy.reinstated",
    )
)

default_manager.add(
    AuditLogEvent(
        event_id=1152,
        name="TEMPEST_CLIENT_ID_ADD",
        api_name="playstation-client-id.create",
        template="added playstation client id {client_id}",
    )
)

default_manager.add(
    AuditLogEvent(
        event_id=1153,
        name="TEMPEST_CLIENT_ID_REMOVE",
        api_name="playstation-client-id.remove",
        template="removed playstation client id {client_id}",
    )
)

default_manager.add(
    AuditLogEvent(
        event_id=220,
        name="TRUSTED_RELAY_ADD",
        api_name="trusted-relay.add",
        template="added trusted relay {name} with public key {public_key}",
    )
)

default_manager.add(
    AuditLogEvent(
        event_id=221,
        name="TRUSTED_RELAY_EDIT",
        api_name="trusted-relay.edit",
        template="edited trusted relay {name} with public key {public_key}",
    )
)
