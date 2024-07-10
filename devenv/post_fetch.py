from __future__ import annotations

import configparser


def main(context: dict[str, str]) -> int:
    # post_fetch is meant for recommended but not required defaults
    reporoot = context["reporoot"]

    git_config = configparser.ConfigParser()
    git_config.read(f"{reporoot}/.git/config")
    git_config["blame"] = {"ignoreRevsFile": ".git-blame-ignore-revs"}
    git_config["branch"] = {"autosetuprebase": "always"}

    with open(f"{reporoot}/.git/config", "w") as f:
        git_config.write(f)

    return 0
