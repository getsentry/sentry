from __future__ import annotations

import configparser
import os
import subprocess

from devenv import constants
from devenv.lib import venv  # type: ignore
from devenv.lib import colima, config, limactl, proc, volta


# TODO: need to replace this with a nicer process executor in devenv.lib
def run_procs(
    repo: str,
    reporoot: str,
    venv_path: str,
    _procs: tuple[tuple[str, tuple[str, ...]], ...],
) -> bool:
    procs: list[tuple[str, tuple[str, ...], subprocess.Popen[bytes]]] = []

    for name, cmd in _procs:
        print(f"⏳ {name}")
        if constants.DEBUG:
            proc.xtrace(cmd)
        procs.append(
            (
                name,
                cmd,
                subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    env={
                        **constants.user_environ,
                        **proc.base_env,
                        "VIRTUAL_ENV": venv_path,
                        "VOLTA_HOME": constants.VOLTA_HOME,
                        "PATH": f"{venv_path}/bin:{proc.base_path}",
                    },
                    cwd=reporoot,
                ),
            )
        )

    all_good = True
    for name, final_cmd, p in procs:
        out, _ = p.communicate()
        if p.returncode != 0:
            all_good = False
            out = "" if out is None else out.decode()
            print(
                f"""
❌ {name}

failed command (code p.returncode):
    {proc.quote(final_cmd)}

Output:
{out}

"""
            )
        else:
            print(f"✅ {name}")

    return all_good


def main(context: dict[str, str]) -> int:
    repo = context["repo"]
    reporoot = context["reporoot"]

    venv_dir, python_version, requirements, editable_paths, bins = venv.get(reporoot, repo)
    url, sha256 = config.get_python(reporoot, python_version)
    print(f"ensuring {repo} venv at {venv_dir}...")
    venv.ensure(venv_dir, python_version, url, sha256)

    # This is for engineers with existing dev environments transitioning over.
    # Bootstrap will set devenv-managed volta up but they won't be running
    # devenv bootstrap, just installing devenv then running devenv sync.
    # make install-js-dev will fail since our run_procs expects devenv-managed
    # volta.
    volta.install()

    if constants.DARWIN:
        repo_config = configparser.ConfigParser()
        repo_config.read(f"{reporoot}/devenv/config.ini")

        # we don't officially support colima on linux yet
        if constants.CI:
            # colima 0.6.8 doesn't work with macos-13,
            # but integration coverage is still handy
            colima.install(
                "v0.6.2",
                "https://github.com/abiosoft/colima/releases/download/v0.6.2/colima-Darwin-x86_64",
                "43ef3fc80a8347d51b8ec1706f9caf8863bd8727a6f7532caf1ccd20497d8485",
            )
        else:
            colima.install(
                repo_config["colima"]["version"],
                repo_config["colima"][constants.SYSTEM_MACHINE],
                repo_config["colima"][f"{constants.SYSTEM_MACHINE}_sha256"],
            )

        # TODO: move limactl version into per-repo config
        limactl.install()

    if not run_procs(
        repo,
        reporoot,
        venv_dir,
        (
            ("javascript dependencies", ("make", "install-js-dev")),
            ("python dependencies", ("make", "install-py-dev")),
        ),
    ):
        return 1

    if not run_procs(
        repo,
        reporoot,
        venv_dir,
        (
            (
                "git and precommit",
                # this can't be done in paralell with python dependencies
                # as multiple pips cannot act on the same venv
                ("make", "setup-git"),
            ),
        ),
    ):
        return 1

    if not os.path.exists(f"{constants.home}/.sentry/config.yml") or not os.path.exists(
        f"{constants.home}/.sentry/sentry.conf.py"
    ):
        proc.run((f"{venv_dir}/bin/{repo}", "init", "--dev"))

    # TODO: check healthchecks for redis and postgres to short circuit this
    proc.run(
        (
            f"{venv_dir}/bin/{repo}",
            "devservices",
            "up",
            "redis",
            "postgres",
        ),
        exit=True,
    )

    if run_procs(
        repo,
        reporoot,
        venv_dir,
        (
            (
                "python migrations",
                (f"{venv_dir}/bin/{repo}", "upgrade", "--noinput"),
            ),
        ),
    ):
        return 0

    return 1
