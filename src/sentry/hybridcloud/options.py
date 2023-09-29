from sentry.options import FLAG_AUTOMATOR_MODIFIABLE, register
from sentry.utils.types import Bool, Int

register(
    "outbox_replication.sentry_team.replication_version",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_organization.replication_version",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_authidentity.replication_version",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_authprovider.replication_version",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_organizationmember_teams.replication_version",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_apikey.replication_version",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.auth_user.replication_version",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_organizationslugreservation.replication_version",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_userrole.replication_version",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "outbox_replication.sentry_userrole_users.replication_version",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "hybrid_cloud.authentication.use_api_key_replica",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
