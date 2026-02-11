from __future__ import annotations

import configparser
import shutil
import subprocess

from devenv import constants
from devenv.lib import proc

# we only support apt-based linuxes
LINUX = shutil.which("dpkg") is not None

# these are the subset of requirements from the Brewfile that are necessary on linux
REQUIRED_APT_PKGS = ["watchman", "chromium-chromedriver"]


def dpkg_is_installed(pkg: str) -> bool:
    try:
        out = subprocess.check_output(
            ["dpkg-query", "-W", "-f=${Status}", pkg],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except subprocess.CalledProcessError:
        return False

    # <want> <error> <status>
    return out == "install ok installed"


def dpkgs_not_installed(pkgs: list[str]) -> list[str]:
    return [pkg for pkg in pkgs if not dpkg_is_installed(pkg)]


def main(context: dict[str, str]) -> int:
    reporoot = context["reporoot"]

    if constants.DARWIN:
        print("Installing sentry's brew dependencies...")
        if constants.CI:
            # Installing everything from brew takes too much time,
            # and chromedriver cask flakes occasionally. Really all we need to
            # set up the devenv is colima and docker-cli.
            # This is also required for arm64 macOS GHA runners.
            # We manage colima, so just need to install docker + qemu here.
            proc.run(("brew", "install", "docker", "qemu"))
        else:
            proc.run(
                (f"{constants.homebrew_bin}/brew", "bundle"),
                cwd=reporoot,
            )
    elif LINUX:
        if not constants.CI:
            not_installed = dpkgs_not_installed(REQUIRED_APT_PKGS)
            if not_installed:
                raise SystemExit(
                    f"Please install the following apt packages: {' '.join(not_installed)}"
                )
    else:
        print(
            f"Unsupported platform; assuming you have the equivalent of the following apt packages installed: {' '.join(REQUIRED_APT_PKGS)}"
        )

    git_config = configparser.ConfigParser()
    git_config.read(f"{reporoot}/.git/config")
    git_config["blame"] = {"ignoreRevsFile": ".git-blame-ignore-revs"}
    git_config["branch"] = {"autosetuprebase": "always"}

    with open(f"{reporoot}/.git/config", "w") as f:
        git_config.write(f)

    return 0
