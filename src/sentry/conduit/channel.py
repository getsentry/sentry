"""Deterministic Conduit channel derivation for Seer runs.

A run outlives any single browser connection (reconnects, refreshes, a second tab),
so the channel it streams on cannot be minted per-connection the way the Conduit demo
endpoint does it. Deriving the channel from the run id instead lets Sentry and Seer
each compute the same value independently -- no shared storage, no round trip, and
every consumer of a run lands on the same stream.

The derivation is a hash, not a secret: knowing a run id yields its channel id. That
is fine because the channel is not the authorization boundary. Conduit's gateway
requires an RS256 token whose ``org_id`` *and* ``channel_id`` claims match the
request, and only Sentry can mint one -- and only after the permission checks in
``OrganizationSeerExplorerStreamCredentialsEndpoint``.
"""

import uuid

# Wire-format constant. MUST stay identical to CONDUIT_CHANNEL_NAMESPACE in seer's
# src/seer/conduit/channel.py -- the two services derive channel ids independently
# and only agree because they share this seed. Changing it silently breaks every
# in-flight run at deploy (Sentry hands the browser one channel while Seer publishes
# to another), so treat it as immutable.
CONDUIT_CHANNEL_NAMESPACE = uuid.UUID("6f1a8f5e-3e9a-4a52-9b3b-2f0b6a7c1d84")


def channel_id_for_seer_run(seer_run_state_id: int) -> str:
    """The Conduit channel a Seer run streams on.

    Args:
        seer_run_state_id: The id of Seer's ``DbRunState`` row, which is what
            ``SeerRun.seer_run_state_id`` mirrors. Not ``SeerRun.id`` and not the
            run's uuid -- Seer only knows its own id, so that is what both sides
            must derive from.
    """
    return str(uuid.uuid5(CONDUIT_CHANNEL_NAMESPACE, f"seer-run:{seer_run_state_id}"))
