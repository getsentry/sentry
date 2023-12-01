#!/usr/bin/env python3
from __future__ import annotations

import argparse
import configparser
import os.path
import stat
import sys
import sysconfig


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", default=".")
    args = parser.parse_args()

    # simulate `pip install -e .` -- but bypass setuptools

    def r(p: str) -> str:
        return os.path.relpath(p, ".")

    # must be in a virtualenv
    assert not sys.flags.no_site, sys.flags.no_site
    site_dir = sysconfig.get_path("purelib")
    bin_dir = sysconfig.get_path("scripts")
    assert "/.venv/" in site_dir, site_dir

    cfg = configparser.RawConfigParser()
    cfg.read(os.path.join(args.path, "setup.cfg"))

    package_name = cfg["metadata"]["name"]

    package_dir = cfg["options"].get("package_dir", "").strip()
    if package_dir not in {"", "=src"}:
        raise SystemExit(f"unsupported package_dir={package_dir!r}")

    project_root = os.path.abspath(args.path)
    if package_dir == "=src":
        source_root = os.path.join(project_root, "src")
        project_root_relative = "../"
    else:
        source_root = project_root
        project_root_relative = "."

    # egg-link indicates that the software is installed
    egg_link = os.path.join(site_dir, f"{package_name}.egg-link")
    print(f"writing {r(egg_link)}...")
    with open(egg_link, "w") as f:
        f.write(f"{source_root}\n{project_root_relative}")

    # easy-install.pth is how code gets imported
    easy_install_pth = os.path.join(site_dir, "easy-install.pth")
    print(f"adding {r(source_root)} to {r(easy_install_pth)}...")
    try:
        with open(easy_install_pth) as f:
            easy_install_paths = f.read().splitlines()
    except OSError:
        easy_install_paths = []
    if source_root not in easy_install_paths:
        easy_install_paths.append(source_root)
        with open(easy_install_pth, "w") as f:
            f.write("\n".join(easy_install_paths) + "\n")

    # 0. create bin scripts for anything in `console_scripts`
    console_scripts = cfg["options.entry_points"]["console_scripts"].strip()
    for line in console_scripts.splitlines():
        entry, rest = line.split(" = ")
        mod, attr = rest.split(":")

        binary = os.path.join(bin_dir, entry)
        print(f"writing {r(binary)}...")
        with open(binary, "w") as f:
            f.write(
                f"#!{sys.executable}\n"
                f"from {mod} import {attr}\n"
                f'if __name__ == "__main__":\n'
                f"    raise SystemExit({attr}())\n"
            )
        mode = os.stat(binary).st_mode
        mode |= stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
        os.chmod(binary, mode)

    # 0. write out the `sentry.egg-info` directory in `src/`
    egg_info_dir = os.path.join(source_root, f"{package_name}.egg-info")
    print(f"creating {r(egg_info_dir)}...")
    os.makedirs(egg_info_dir, exist_ok=True)

    entry_points_txt = os.path.join(egg_info_dir, "entry_points.txt")
    print(f"writing {r(entry_points_txt)}...")
    ep_cfg = configparser.RawConfigParser()
    for section, eps in cfg["options.entry_points"].items():
        ep_cfg.add_section(section)
        for ep in eps.strip().splitlines():
            k, v = ep.split(" = ")
            ep_cfg[section][k] = v
    with open(entry_points_txt, "w") as f:
        ep_cfg.write(f)

    pkg_info = os.path.join(egg_info_dir, "PKG-INFO")
    print(f"writing {r(pkg_info)}...")
    with open(pkg_info, "w") as f:
        f.write(
            f"Metadata-Version: 2.1\n"
            f"Name: {package_name}\n"
            f"Version: {cfg['metadata']['version']}\n"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
