import os
import subprocess
import sys
import time

from sentry.testutils.pytest.sentry import configure_split_db
from sentry.utils import json


def pytest_configure(config):
    """
    Generate frontend assets before running any acceptance tests

    TODO: There is a bug if you run `py.test` with `-f` -- the built
    assets will trigger another `py.test` run.
    """

    # Do not build in CI because tests are run w/ `make test-acceptance` which builds assets
    # Can also skip with the env var `SKIP_ACCEPTANCE_UI_BUILD`
    # `CI` is a default env var in GHA (https://docs.github.com/en/free-pro-team@latest/actions/reference/environment-variables#default-environment-variables)
    if os.environ.get("CI") or os.environ.get("SKIP_ACCEPTANCE_UI_BUILD"):
        return

    try:
        with open("./.webpack.meta") as f:
            data = json.load(f)

            # If built within last hour, do not build again
            last_built = int(time.time()) - data["built"]

            if last_built <= 3600:
                print(  # noqa: S002
                    f"""
###################
#
# Frontend assets last built {last_built} seconds ago, skipping rebuilds for another {3600 - last_built} seconds.
# Delete the file: `.webpack.meta` to rebuild.
#
###################
                """,
                    file=sys.stderr,
                )
                return
    except OSError:
        pass
    except Exception:
        pass

    print(  # noqa: S002
        """
###################
#
# Running webpack to compile frontend assets - this will take awhile
#
###################
    """
    )

    try:
        status = subprocess.call(
            ["yarn", "build-acceptance"],
            env={"PATH": os.environ["PATH"], "NODE_OPTIONS": "--max-old-space-size=4096"},
        )

        if status != 0:
            raise Exception(
                "Unable to run `webpack` -- make sure your development environment is setup correctly: https://docs.sentry.io/development/contribute/environment/#macos---nodejs"
            )
    except OSError:
        raise Exception(
            "Unable to run `yarn` -- make sure your development environment is setup correctly: https://docs.sentry.io/development/contribute/environment/#macos---nodejs"
        )

    configure_split_db()
