"""Backward-compat shim for getsentry, which imports
``sentry.seer.explorer.client_utils.explorer_connection_pool``. Remove this
module (and the empty ``sentry/seer/explorer/__init__.py``) once getsentry
has migrated to ``sentry.seer.agent.client_utils.agent_connection_pool``.
"""

from sentry.seer.agent.client_utils import (  # noqa: F401
    agent_connection_pool as explorer_connection_pool,
)
