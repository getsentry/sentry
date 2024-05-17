from __future__ import annotations

import argparse
import os
import subprocess


def _build_static_assets() -> None:
    node_options = os.environ.get("NODE_OPTIONS", "")
    env = {
        **os.environ,
        # By setting NODE_ENV=production, a few things happen
        #   * React optimizes out certain code paths
        #   * Webpack will add version strings to built/referenced assets
        "NODE_ENV": "production",
        # TODO: Our JS builds should not require 4GB heap space
        "NODE_OPTIONS": f"{node_options} --max-old-space-size=4096".lstrip(),
    }

    def _cmd(*cmd: str) -> None:
        ret = subprocess.call(cmd, env=env)
        if ret:
            raise SystemExit(ret)

    _cmd("yarn", "install", "--production", "--frozen-lockfile", "--quiet")
    _cmd("yarn", "tsc", "-p", "config/tsconfig.build.json")
    _cmd("yarn", "build-production", "--bail")
    _cmd("yarn", "build-chartcuterie-config", "--bail")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args()

    _build_static_assets()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
