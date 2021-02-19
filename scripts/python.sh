#!/bin/bash
# This script correctly installs Python dependencies
set -eu

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")"; pwd -P)"
# shellcheck disable=SC1090
source "${HERE}/lib.sh"

ensure-venv() {
    ./scripts/ensure-venv.sh
}

upgrade-pip() {
    # pip versions before 20.1 do not have `pip cache` as a command which is necessary for the CI
    pip install --no-cache-dir --upgrade "pip>=20.1"
}

install-py-dev() {
    ensure-venv
    upgrade-pip
    # The Python version installed via pyenv does not come with wheel pre-installed
    # Installing wheel will speed up installation of Python dependencies
    require wheel || pip install wheel
    echo "--> Installing Sentry (for development)"
    # In Big Sur, versions of pip before 20.3 require SYSTEM_VERSION_COMPAT set
    old_pip=$(python -c 'import sys; import pip; from pip._vendor.packaging.version import parse; print(1 if parse(pip.__version__) < parse("20.3") else 0)')
    if query_big_sur && [[ $old_pip == 1 ]]; then
        SENTRY_LIGHT_BUILD=1 SYSTEM_VERSION_COMPAT=1 pip install -e '.[dev]'
    else
        # SENTRY_LIGHT_BUILD=1 disables webpacking during setup.py.
	    # Webpacked assets are only necessary for devserver (which does it lazily anyways)
	    # and acceptance tests, which webpack automatically if run.
        SENTRY_LIGHT_BUILD=1 pip install -e '.[dev]'
    fi
}

"$@"
