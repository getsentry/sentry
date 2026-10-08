from sentry import options
from sentry.options import FLAG_AUTOMATOR_MODIFIABLE

# Options without FLAG_AUTOMATOR_MODIFIABLE are served from config files, the
# database or the admin UI instead of sentry-options. No new ones may be added;
# this list only shrinks as they move to Django settings.
LEGACY_OPTIONS = frozenset(
    {
        # Bootstrap input; credentials are read from SECRET_KEY.
        "system.secret-key",
        # Edited in the self-hosted setup wizard and admin UI.
        "auth.allow-registration",
        "beacon.anonymous",
        "beacon.record_cpu_ram_usage",
        "mail.from",
        "mail.host",
        "mail.password",
        "mail.port",
        "mail.use-ssl",
        "mail.use-tls",
        "mail.username",
        "system.admin-email",
        "system.url-prefix",
        # Backs the options cache itself.
        "redis.clusters",
    }
)


def test_no_new_legacy_options() -> None:
    legacy = {key.name for key in options.all() if not key.flags & FLAG_AUTOMATOR_MODIFIABLE}

    added = sorted(legacy - LEGACY_OPTIONS)
    assert not added, (
        f"New options must have FLAG_AUTOMATOR_MODIFIABLE: {added}. A runtime knob "
        "registers with FLAG_AUTOMATOR_MODIFIABLE and gets an entry in getsentry's "
        "sentry-options/schemas/getsentry/schema.json. Deployment configuration "
        "(credentials, identifiers, URLs) is a Django setting in "
        "src/sentry/conf/server.py instead."
    )

    removed = sorted(LEGACY_OPTIONS - legacy)
    assert not removed, f"Remove these from LEGACY_OPTIONS: {removed}"


def test_seer_token_metrics_remains_admin_modifiable_and_accepts_automator() -> None:
    from sentry.options import UpdateChannel

    key = "seer.similarity.token_count_metrics_enabled"
    assert options.can_update(key, False, UpdateChannel.ADMIN, include_drift=False) is None
    assert options.can_update(key, False, UpdateChannel.AUTOMATOR, include_drift=False) is None
    assert options.lookup_key(key).default() is True
