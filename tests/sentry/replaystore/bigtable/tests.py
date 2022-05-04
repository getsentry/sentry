import os
from contextlib import contextmanager

import pytest
from google.oauth2.credentials import Credentials

from sentry.replaystore.bigtable.backend import BigTableReplayStore


@contextmanager
def get_temporary_bigtable_replaystore() -> BigTableReplayStore:
    if "BIGTABLE_EMULATOR_HOST" not in os.environ:
        pytest.skip(
            "Bigtable is not available, set BIGTABLE_EMULATOR_HOST enironment variable to enable"
        )

    # The bigtable emulator requires _something_ to be passed as credentials,
    # even if they're totally bogus ones.
    ns = BigTableReplayStore(
        project="test",
        credentials=Credentials.from_authorized_user_info(
            {key: "invalid" for key in ["client_id", "refresh_token", "client_secret"]}
        ),
    )

    ns.bootstrap()

    try:
        yield ns
    finally:
        ns.store.destroy()
