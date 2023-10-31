from sentry.options import FLAG_AUTOMATOR_MODIFIABLE, register

register(
    "outbox_replication.sentry_organizationmember.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_team.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_organization.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_authidentity.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_authprovider.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_organizationmember_teams.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_apikey.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.auth_user.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_organizationslugreservation.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_userrole.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_userpermission.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_useremail.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.auth_authenticator.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_userrole_users.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_organizationintegration.replication_version",
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "hybrid_cloud.authentication.use_api_key_replica",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
