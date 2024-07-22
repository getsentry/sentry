from __future__ import annotations

import concurrent.futures
import configparser
import functools
import os

from libdevinfra.jobs import Job, Task, run_jobs

from devenv import constants
from devenv.lib import colima, config, fs, limactl, proc, venv, volta


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

    jp1 = Task(
        name="upgrade pip",
        func=functools.partial(
            proc.run,
            (
                f"{venv_dir}/bin/python3",
                "-m",
                "pip",
                "--disable-pip-version-check",
                "install",
                "--constraint",
                "requirements-dev-frozen.txt",
                "pip",
            ),
            stdout=True,
        ),
    )
    jp2 = Task(
        name="uninstall some problems",
        func=functools.partial(
            proc.run,
            (
                f"{venv_dir}/bin/python3",
                "-m",
                "pip",
                "--disable-pip-version-check",
                "uninstall",
                "-qqy",
                "djangorestframework-stubs",
                "django-stubs",
            ),
            stdout=True,
        ),
    )
    jp3 = Task(
        name="install dependencies",
        func=functools.partial(
            proc.run,
            (
                f"{venv_dir}/bin/python3",
                "-m",
                "pip",
                "--disable-pip-version-check",
                "install",
                "--constraint",
                "requirements-dev-frozen.txt",
                "-r",
                "requirements-dev-frozen.txt",
            ),
            stdout=True,
        ),
    )
    jp4 = Task(
        name="install editable",
        func=functools.partial(
            proc.run,
            (f"{venv_dir}/bin/python3", "-m", "tools.fast_editable", "--path", "."),
            stdout=True,
        ),
    )
    jp5 = Task(
        name="init sentry config",
        func=functools.partial(
            proc.run,
            (f"{venv_dir}/bin/sentry", "init", "--dev", "--no-clobber"),
            stdout=True,
        ),
    )
    jpc1 = Task(
        name="install pre-commit dependencies",
        func=functools.partial(
            proc.run,
            (f"{venv_dir}/bin/pre-commit", "install", "--install-hooks", "-f"),
            stdout=True,
        ),
    )
    jm1 = Task(
        name="bring up redis and postgres",
        func=functools.partial(
            proc.run,
            (f"{venv_dir}/bin/sentry", "devservices", "up", "redis", "postgres"),
            stdout=True,
        ),
    )
    jm2 = Task(
        name="apply migrations",
        func=functools.partial(
            proc.run,
            ("make", "apply-migrations"),
            pathprepend=f"{venv_dir}/bin:{reporoot}/.devenv/bin",
            env={"VIRTUAL_ENV": venv_dir},
            stdout=True,
        ),
    )
    jt1 = Task(
        name="install js dependencies",
        func=functools.partial(
            proc.run,
            (
                "yarn",
                "install",
                "--frozen-lockfile",
                "--no-progress",
                "--non-interactive",
            ),
            pathprepend=f"{venv_dir}/bin:{reporoot}/.devenv/bin",
            env={
                "NODE_ENV": "development",
                "VOLTA_HOME": f"{reporoot}/.devenv/bin/volta-home",
            },
            stdout=True,
        ),
    )

    jp = Job(name="python dependencies", tasks=(jp1, jp2, jp3, jp4, jp5))
    jm = Job(name="sentry migrations", tasks=(jm1, jm2))
    jpc = Job(name="pre-commit dependencies", tasks=(jpc1,))
    jt = Job(name="javascript dependencies", tasks=(jt1,))

    # after python deps are installed we can install pre-commit deps
    jp3.spawn_jobs = (jpc,)

    # Frontend engineers don't necessarily always have devservices running and
    # can configure to skip them to save on local resources
    if FRONTEND_ONLY:
        print("Skipping python migrations since SENTRY_DEVENV_FRONTEND_ONLY is set.")
    else:
        jp5.spawn_jobs = (jm,)

    with concurrent.futures.ThreadPoolExecutor() as tpe:
        run_jobs((jp, jt), tpe)

    fs.ensure_symlink("../../config/hooks/post-merge", f"{reporoot}/.git/hooks/post-merge")
