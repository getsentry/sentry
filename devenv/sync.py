from __future__ import annotations

import configparser
import os
import subprocess

from devenv import constants
from devenv.lib import colima, config, limactl, proc, venv, volta


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
                        "VOLTA_HOME": f"{reporoot}/.devenv/bin/volta-home",
                        "PATH": f"{venv_path}/bin:{reporoot}/.devenv/bin:{proc.base_path}",
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
            out_str = "" if out is None else out.decode()
            print(
                f"""
❌ {name}

failed command (code p.returncode):
    {proc.quote(final_cmd)}

Output:
{out_str}

"""
            )
        else:
            print(f"✅ {name}")

    return all_good


def main(context: dict[str, str]) -> int:
    repo = context["repo"]
    reporoot = context["reporoot"]
    skip_devservices = os.environ.get("SENTRY_DEVENV_SKIP_DEVSERVICES") is not None

    # don't want this to be accidentally run from getsentry
    assert repo == "sentry", repo

    venv_dir, python_version, requirements, editable_paths, bins = venv.get(reporoot, repo)
    url, sha256 = config.get_python(reporoot, python_version)
    print(f"ensuring {repo} venv at {venv_dir}...")
    venv.ensure(venv_dir, python_version, url, sha256)

    # TODO: move volta version into per-repo config
    try:
        volta.install(reporoot)
    except TypeError:
        # this is needed for devenv <=1.4.0,>1.2.3 to finish syncing and therefore update itself
        volta.install()

    if constants.DARWIN and not skip_devservices:
        repo_config = configparser.ConfigParser()
        repo_config.read(f"{reporoot}/devenv/config.ini")

        try:
            colima.install(
                repo_config["colima"]["version"],
                repo_config["colima"][constants.SYSTEM_MACHINE],
                repo_config["colima"][f"{constants.SYSTEM_MACHINE}_sha256"],
                reporoot,
            )
        except TypeError:
            # this is needed for devenv <=1.4.0,>1.2.3 to finish syncing and therefore update itself
            colima.install(
                repo_config["colima"]["version"],
                repo_config["colima"][constants.SYSTEM_MACHINE],
                repo_config["colima"][f"{constants.SYSTEM_MACHINE}_sha256"],
            )

        # TODO: move limactl version into per-repo config
        try:
            limactl.install(reporoot)
        except TypeError:
            # this is needed for devenv <=1.4.0,>1.2.3 to finish syncing and therefore update itself
            limactl.install()

    if not run_procs(
        repo,
        reporoot,
        venv_dir,
        (
            (
                "javascript dependencies",
                (
                    "bash",
                    "-euo",
                    "pipefail",
                    "-c",
                    """
NODE_ENV=development ./.devenv/bin/yarn install --frozen-lockfile
yarn check --verify-tree || yarn install --check-files
""",
                ),
            ),
            (
                "python dependencies",
                (
                    "bash",
                    "-euo",
                    "pipefail",
                    "-c",
                    """
# install pinned pip
pip install --constraint requirements-dev-frozen.txt pip

# pip doesn't do well with swapping drop-ins
pip uninstall -qqy djangorestframework-stubs django-stubs

pip install -r requirements-dev-frozen.txt

python3 -m tools.fast_editable --path .
""",
                ),
            ),
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

    # Frontend engineers don't necessarily always have devservices running and
    # can configure to skip them to save on local resources
    if skip_devservices:
        return 0

    if not os.path.exists(f"{constants.home}/.sentry/config.yml") or not os.path.exists(
        f"{constants.home}/.sentry/sentry.conf.py"
    ):
        proc.run((f"{venv_dir}/bin/sentry", "init", "--dev", "--no-clobber"))

    # TODO: check healthchecks for redis and postgres to short circuit this
    proc.run(
        (
            f"{venv_dir}/bin/sentry",
            "devservices",
            "up",
            "redis",
            "postgres",
        ),
        pathprepend=f"{reporoot}/.devenv/bin",
        exit=True,
    )

    if not run_procs(
        repo,
        reporoot,
        venv_dir,
        (
            (
                "python migrations",
                (
                    "bash",
                    "-euo",
                    "pipefail",
                    "-c",
                    """
make create-db
sentry upgrade --noinput
""",
                ),
            ),
        ),
    ):
        return 1

    # Starting sentry is slow.
    stdout = proc.run(
        (
            "docker",
            "exec",
            "sentry_postgres",
            "psql",
            "sentry",
            "postgres",
            "-t",
            "-c",
            "select exists (select from auth_user where email = 'admin@sentry.io')",
        ),
        stdout=True,
    )
    if stdout != "t":
        proc.run(
            (
                f"{venv_dir}/bin/sentry",
                "createuser",
                "--superuser",
                "--email",
                "admin@sentry.io",
                "--password",
                "admin",
                "--no-input",
            )
        )

    return 0
