from __future__ import annotations

import configparser
import os
import shlex
import subprocess

from devenv import constants
from devenv.lib import colima, config, fs, limactl, proc, venv, volta


# TODO: need to replace this with a nicer process executor in devenv.lib
def run_procs(
    repo: str,
    reporoot: str,
    venv_path: str,
    _procs: tuple[tuple[str, tuple[str, ...], dict[str, str]], ...],
) -> bool:
    procs: list[tuple[str, tuple[str, ...], subprocess.Popen[bytes]]] = []

    for name, cmd, extra_env in _procs:
        print(f"⏳ {name}")
        if constants.DEBUG:
            proc.xtrace(cmd)
        env = {
            **constants.user_environ,
            **proc.base_env,
            "VIRTUAL_ENV": venv_path,
            "VOLTA_HOME": f"{reporoot}/.devenv/bin/volta-home",
            "PATH": f"{venv_path}/bin:{reporoot}/.devenv/bin:{proc.base_path}",
        }
        if extra_env:
            env = {**env, **extra_env}
        procs.append(
            (
                name,
                cmd,
                subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    env=env,
                    cwd=reporoot,
                ),
            )
        )

    all_good = True
    for name, final_cmd, p in procs:
        out, _ = p.communicate()
        if p.returncode != 0:
            all_good = False
            print(
                f"""
❌ {name}

failed command (code {p.returncode}):
    {shlex.join(final_cmd)}

Output:
{out.decode()}

"""
            )
        else:
            print(f"✅ {name}")

    return all_good


def main(context: dict[str, str]) -> int:
    repo = context["repo"]
    reporoot = context["reporoot"]

    FRONTEND_ONLY = os.environ.get("SENTRY_DEVENV_FRONTEND_ONLY") is not None

    # venv's still needed for frontend because repo-local devenv and pre-commit
    # exist inside it
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

    if constants.DARWIN:
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
            # TODO: devenv should provide a job runner (jobs run in parallel, tasks run sequentially)
            (
                "python dependencies (1/4)",
                (
                    # upgrading pip first
                    "pip",
                    "install",
                    "--constraint",
                    "requirements-dev-frozen.txt",
                    "pip",
                ),
                {},
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
                # Spreading out the network load by installing js,
                # then py in the next batch.
                "javascript dependencies (1/1)",
                (
                    "yarn",
                    "install",
                    "--frozen-lockfile",
                    "--no-progress",
                    "--non-interactive",
                ),
                {
                    "NODE_ENV": "development",
                },
            ),
            (
                "python dependencies (2/4)",
                (
                    "pip",
                    "uninstall",
                    "-qqy",
                    "djangorestframework-stubs",
                    "django-stubs",
                ),
                {},
            ),
        ),
    ):
        return 1

    if not run_procs(
        repo,
        reporoot,
        venv_dir,
        (
            # could opt out of syncing python if FRONTEND_ONLY but only if repo-local devenv
            # and pre-commit were moved to inside devenv and not the sentry venv
            (
                "python dependencies (3/4)",
                (
                    "pip",
                    "install",
                    "--constraint",
                    "requirements-dev-frozen.txt",
                    "-r",
                    "requirements-dev-frozen.txt",
                ),
                {},
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
                "python dependencies (4/4)",
                ("python3", "-m", "tools.fast_editable", "--path", "."),
                {},
            ),
            ("pre-commit dependencies", ("pre-commit", "install", "--install-hooks", "-f"), {}),
        ),
    ):
        return 1

    fs.ensure_symlink("../../config/hooks/post-merge", f"{reporoot}/.git/hooks/post-merge")

    if not os.path.exists(f"{constants.home}/.sentry/config.yml") or not os.path.exists(
        f"{constants.home}/.sentry/sentry.conf.py"
    ):
        proc.run((f"{venv_dir}/bin/sentry", "init", "--dev"))

    # Frontend engineers don't necessarily always have devservices running and
    # can configure to skip them to save on local resources
    if FRONTEND_ONLY:
        print("Skipping python migrations since SENTRY_DEVENV_FRONTEND_ONLY is set.")
        return 0

    # TODO: check healthchecks for redis and postgres to short circuit this
    proc.run(
        (
            f"{venv_dir}/bin/{repo}",
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
                ("make", "apply-migrations"),
                {},
            ),
        ),
    ):
        return 1

    # faster prerequisite check than starting up sentry and running createuser idempotently
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

    return 1
