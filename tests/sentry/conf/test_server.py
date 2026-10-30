import os
import subprocess
import sys

import pytest

from sentry.utils import json

DEV_GRANT_PUBLIC_KEY = (
    "-----BEGIN PUBLIC KEY-----\n"
    "MCowBQYDK2VwAyEAq8SFj6uFiEB74zliRdruAG69shgf1FNJbj/UCnK0jFM=\n"
    "-----END PUBLIC KEY-----\n"
)


def scm_git_grant_public_keys(**environ: str) -> list[str]:
    # The settings module reads the environment once, when it's imported, so each environment
    # gets its own interpreter.
    env = {
        name: value
        for name, value in os.environ.items()
        if name not in ("SENTRY_ENVIRONMENT", "SENTRY_SILO_DEVSERVER")
    }
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import json, sentry.conf.server as s; print(json.dumps(s.SCM_GIT_GRANT_PUBLIC_KEYS))",
        ],
        env=env | environ,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def test_production_trusts_no_git_grant_key() -> None:
    # Self-hosted inherits this default, and the dev key's private half is public.
    assert scm_git_grant_public_keys() == []


@pytest.mark.parametrize(
    "environ",
    [{"SENTRY_ENVIRONMENT": "development"}, {"SENTRY_SILO_DEVSERVER": "1"}],
)
def test_dev_trusts_the_key_local_seer_signs_with(environ: dict[str, str]) -> None:
    assert scm_git_grant_public_keys(**environ) == [DEV_GRANT_PUBLIC_KEY]
