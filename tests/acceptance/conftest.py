from __future__ import absolute_import

import os
import json
import subprocess
import time


def pytest_configure(config):
    """
    Generate frontend assets before running any acceptance tests

    TODO: There is a bug if you run `py.test` with `-f` -- the built
    assets will trigger another `py.test` run.
    """

    # Do not build in CI because tests are run w/ `make test-acceptance` which builds assets
    if os.environ.get("CI") or os.environ.get("SKIP_ACCEPTANCE_UI_BUILD"):
        return

    try:
        with open("./.webpack.meta") as f:
            data = json.load(f)

            # If built within last hour, do not build again
            last_built = int(time.time()) - data["built"] / 1000

            if last_built <= 3600:
                print (  # noqa: B314
                    """
###################
#
# Frontend assets last built %d seconds ago, skipping rebuilds for another %d seconds.
# Delete the file: `.webpack.meta` to rebuild.
#
###################
                """
                    % (last_built, 3600 - last_built)
                )
                return
    except IOError:
        pass
    except Exception:
        pass

    print (  # noqa: B314
        """
###################
#
# Running webpack to compile frontend assets - this will take awhile
#
###################
    """
    )

    subprocess.call(
        ["yarn", "webpack"], env={"NODE_ENV": "development", "PATH": os.environ["PATH"]}
    )
