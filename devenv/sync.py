from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import tempfile
import time
import urllib.request
import zipfile

from devenv.lib import brew, config, fs, proc

from devenv import constants

Proc = tuple[str, tuple[str, ...], dict[str, str]]

DAY = 24 * 60 * 60
POSTGRES_CONTAINER = "postgres-postgres-1"
LOCKFILE_HEAD = re.compile(r"^(\w+): (\w+)$")


def digest(*paths: str) -> str:
    h = hashlib.md5(usedforsecurity=False)
    for path in paths:
        try:
            with open(path, "rb") as f:
                h.update(f.read())
        except FileNotFoundError:
            pass
        h.update(b"\0")
    return h.hexdigest()


def stamped(reporoot: str, step: str, inputs: str, max_age: float | None = None) -> bool:
    """Whether `step` last succeeded on these inputs, and no more than `max_age` seconds ago."""
    path = f"{reporoot}/.devenv/stamps/{step}"
    try:
        with open(path) as f:
            if f.read() != inputs:
                return False
        return max_age is None or time.time() - os.path.getmtime(path) < max_age
    except FileNotFoundError:
        return False


def stamp(reporoot: str, step: str, inputs: str) -> None:
    os.makedirs(f"{reporoot}/.devenv/stamps", exist_ok=True)
    with open(f"{reporoot}/.devenv/stamps/{step}", "w") as f:
        f.write(inputs)


def skills_installed(reporoot: str) -> bool:
    """The same test as `devenv doctor`, so a sync that doctor's fix runs reinstalls them."""
    lock = f"{reporoot}/agents.lock"
    skills = f"{reporoot}/.agents/skills"
    return (
        os.path.isfile(lock)
        and os.path.getsize(lock) > 0
        and os.path.isdir(skills)
        and bool(os.listdir(skills))
    )


def migrated_databases() -> tuple[str, ...]:
    """The databases `sentry upgrade` migrates, per SILO_DEVSERVER in sentry/conf/server.py."""
    if os.environ.get("SENTRY_SILO_DEVSERVER"):
        return ("region", "control")
    return ("sentry",)


def migrations_applied(databases: tuple[str, ...], lockfiles: tuple[str, ...]) -> bool:
    """Whether each database has every app's latest migration from the lockfiles."""
    heads: list[tuple[str, ...]] = []
    for lockfile in lockfiles:
        with open(lockfile) as f:
            heads += [m.groups() for m in map(LOCKFILE_HEAD.match, f.read().splitlines()) if m]
    if not heads:
        return False
    # LOCKFILE_HEAD only matches word characters, so the names are safe to inline.
    values = ", ".join(f"('{app}', '{name}')" for app, name in heads)
    query = f"select count(*) from django_migrations where (app, name) in ({values})"
    for database in databases:
        try:
            p = subprocess.run(
                (
                    *("docker", "exec", POSTGRES_CONTAINER, "psql", "-h", "127.0.0.1"),
                    *("-U", "postgres", "-d", database, "-tAc", query),
                ),
                capture_output=True,
                text=True,
                timeout=10,
            )
        except (OSError, subprocess.TimeoutExpired):
            return False
        if p.returncode != 0 or p.stdout.strip() != str(len(heads)):
            return False
    return True


# TODO: need to replace this with a nicer process executor in devenv.lib
def run_procs(
    reporoot: str,
    venv_path: str,
    _procs: tuple[Proc, ...],
    verbose: bool = False,
) -> bool:
    procs: list[tuple[str, tuple[str, ...], subprocess.Popen[bytes]]] = []

    stdout = subprocess.PIPE if not verbose else None
    stderr = subprocess.STDOUT if not verbose else None

    for name, cmd, extra_env in _procs:
        print(f"⏳ {name}")
        if constants.DEBUG:
            proc.xtrace(cmd)
        env = {
            **constants.user_environ,
            **proc.base_env,
            "VIRTUAL_ENV": venv_path,
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
                    stdout=stdout,
                    stderr=stderr,
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
            out_str = f"Output:\n{out.decode()}" if not verbose else ""
            print(
                f"""
❌ {name}

failed command (code {p.returncode}):
    {shlex.join(final_cmd)}

{out_str}

"""
            )
        else:
            print(f"✅ {name}")

    return all_good


def sync_chromedriver(reporoot: str) -> int:
    if not constants.DARWIN:
        print(
            "not on macOS; for acceptance testing you'll need to install Google Chrome and chromedriver of the same version"
        )
        return 0

    CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    install = f"{reporoot}/.devenv/bin/chromedriver"

    try:
        chrome_ver = subprocess.check_output([CHROME, "--version"], text=True).split()[-1]
    except FileNotFoundError:
        print(f"{CHROME} not found; install Google Chrome to enable acceptance testing")
        return 1

    major = chrome_ver.split(".")[0]
    # ChromeDriver only has to match Chrome's major version, so skip the network when it does.
    try:
        installed = subprocess.check_output([install, "--version"], text=True).split()[1]
        if installed.split(".")[0] == major:
            return 0
    except (OSError, subprocess.CalledProcessError, IndexError):
        pass

    with urllib.request.urlopen(
        "https://googlechromelabs.github.io/chrome-for-testing/latest-versions-per-milestone-with-downloads.json"
    ) as r:
        entry = json.load(r)["milestones"].get(major)
    if not entry or "chromedriver" not in entry["downloads"]:
        print(f"no ChromeDriver release found for Chrome {major}.x")
        return 1

    url = next(
        (d["url"] for d in entry["downloads"]["chromedriver"] if d["platform"] == "mac-arm64"), None
    )
    if not url:
        print(f"no mac-arm64 ChromeDriver download available for {entry['version']}")
        return 1

    print(f"⏳ chromedriver {entry['version']}")
    tmpdir = tempfile.mkdtemp()
    try:
        tmp = os.path.join(tmpdir, "chromedriver.zip")
        urllib.request.urlretrieve(url, tmp)
        with zipfile.ZipFile(tmp) as zf:
            extracted = zf.extract("chromedriver-mac-arm64/chromedriver", tmpdir)
        shutil.move(extracted, install)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    os.chmod(install, 0o755)
    print(f"✅ chromedriver {entry['version']}")
    return 0


def installed_pnpm(version: str, binroot: str) -> bool:
    if shutil.which("pnpm", path=binroot) != f"{binroot}/pnpm" or not os.path.exists(
        f"{binroot}/node-env/bin/pnpm"
    ):
        return False

    # Probe outside the project so pnpm reports its installed version without switching.
    stdout = proc.run((f"{binroot}/pnpm", "--version"), cwd="/", stdout=True)
    installed_version = stdout.strip()
    return version == installed_version


def install_pnpm(version: str, reporoot: str) -> None:
    binroot = fs.ensure_binroot(reporoot)

    if installed_pnpm(version, binroot):
        return

    print(f"installing pnpm {version}...")

    # {binroot}/npm is a devenv-managed shim, so
    # this install -g ends up putting pnpm into
    # .devenv/bin/node-env/bin/pnpm which is pointed
    # to by the {binroot}/pnpm shim
    proc.run((f"{binroot}/npm", "install", "-g", f"pnpm@{version}"), stdout=True)

    fs.write_script(
        f"{binroot}/pnpm",
        """#!/bin/sh
export PATH={binroot}/node-env/bin:"${{PATH}}"
exec {binroot}/node-env/bin/pnpm "$@"
""",
        shell_escape={"binroot": binroot},
    )


def main(context: dict[str, str]) -> int:
    reporoot = context["reporoot"]
    cfg = config.get_repo(reporoot)

    # TODO: context["verbose"]
    verbose = os.environ.get("SENTRY_DEVENV_VERBOSE") is not None

    FRONTEND_ONLY = os.environ.get("SENTRY_DEVENV_FRONTEND_ONLY") is not None
    SKIP_FRONTEND = os.environ.get("SENTRY_DEVENV_SKIP_FRONTEND") is not None
    IN_GIT_WORKTREE = os.path.isfile(f"{reporoot}/.git")

    if constants.DARWIN:
        brew.install()

        # brew bundle updates and upgrades every formula, which takes a while.
        brewfile = digest(f"{reporoot}/Brewfile")
        if not stamped(reporoot, "brew-bundle", brewfile, max_age=DAY):
            proc.run(
                (f"{constants.homebrew_bin}/brew", "bundle"),
                cwd=reporoot,
            )
            stamp(reporoot, "brew-bundle", brewfile)

    if not shutil.which("uv"):
        print("\n\n\ndevenv is no longer managing uv; please run `brew install uv`.\n\n\n")
        return 1

    from devenv.lib import node

    node.install(
        cfg["node"]["version"],
        cfg["node"][constants.SYSTEM_MACHINE],
        cfg["node"][f"{constants.SYSTEM_MACHINE}_sha256"],
        reporoot,
    )

    with open(f"{reporoot}/package.json") as f:
        package_json = json.load(f)
        pnpm = package_json["packageManager"]
        pnpm_version = pnpm.split("@")[-1]

    # TODO: move pnpm install into devenv
    install_pnpm(pnpm_version, reporoot)

    # chromedriver required for acceptance testing
    if sync_chromedriver(reporoot) != 0:
        return 1

    # no more imports from devenv past this point! if the venv is recreated
    # then we won't have access to devenv libs until it gets reinstalled

    # venv's still needed for frontend because repo-local devenv and prek
    # exist inside it

    venv_dir = f"{reporoot}/.venv"

    dependency_procs: list[Proc] = []
    if not SKIP_FRONTEND:
        dependency_procs.append(
            (
                "javascript dependencies",
                (
                    "pnpm",
                    "install",
                    "--frozen-lockfile",
                    "--reporter=append-only",
                ),
                {
                    "NODE_ENV": "development",
                    # this ensures interactive prompts are answered by
                    # the defaults (usually yes), useful for recreating
                    # node_modules if configuration or node version changes
                    "CI": "true",
                },
            )
        )
    # could opt out of syncing python if FRONTEND_ONLY but only if repo-local devenv
    # and prek were moved to inside devenv and not the sentry venv
    dependency_procs.append(
        (
            "python dependencies",
            (
                "uv",
                "sync",
                "--frozen",
                # don't uninstall getsentry, which getsentry's sync installs into this venv
                "--inexact",
                "--quiet",
                "--active",
            ),
            {},
        )
    )
    # pnpm and uv don't depend on each other, so install both at once.
    if not run_procs(reporoot, venv_dir, tuple(dependency_procs), verbose):
        return 1
    # Left behind by the old fast_editable install. Removed only after uv sync, so uv
    # still sees and uninstalls the old egg-link install.
    shutil.rmtree(f"{reporoot}/src/sentry.egg-info", ignore_errors=True)

    # Worktrees share the main checkout's `.git/hooks` (`.git` is a file), so installing
    # from a worktree would point the hooks at that worktree's venv.
    if not IN_GIT_WORKTREE and not run_procs(
        reporoot,
        venv_dir,
        (("prek dependencies", ("prek", "install", "--prepare-hooks", "-f"), {}),),
        verbose,
    ):
        return 1

    # Agent skills are non-fatal — private skill repos may not be accessible in CI.
    # agents.toml doesn't pin skills so they stay current, which a daily install covers.
    agents = digest(f"{reporoot}/agents.toml")
    if (
        os.path.exists(f"{reporoot}/agents.toml")
        and shutil.which("pnpm", path=f"{reporoot}/.devenv/bin")
        and not (
            skills_installed(reporoot) and stamped(reporoot, "agent-skills", agents, max_age=DAY)
        )
    ):
        if run_procs(
            reporoot,
            venv_dir,
            (("agent skills", ("pnpm", "dlx", "@sentry/dotagents", "--project", "install"), {}),),
            verbose,
        ):
            stamp(reporoot, "agent-skills", agents)
        else:
            print("⚠️  agent skills failed to install (non-fatal)")

    if not IN_GIT_WORKTREE:
        fs.ensure_symlink("../../config/hooks/post-merge", f"{reporoot}/.git/hooks/post-merge")
        fs.ensure_symlink(
            "../../config/hooks/post-checkout", f"{reporoot}/.git/hooks/post-checkout"
        )

    sentry_conf = os.environ.get("SENTRY_CONF", f"{constants.home}/.sentry")

    if not os.path.exists(f"{sentry_conf}/config.yml") or not os.path.exists(
        f"{sentry_conf}/sentry.conf.py"
    ):
        proc.run((f"{venv_dir}/bin/sentry", "init", "--dev"))

    if not run_procs(
        reporoot,
        venv_dir,
        (("prod feature flags", ("bin/sync-prod-flags",), {}),),
        verbose,
    ):
        print("⚠️  prod feature flags failed to sync, using registered defaults (non-fatal)")

    # Frontend engineers don't necessarily always have devservices running and
    # can configure to skip them to save on local resources
    if FRONTEND_ONLY:
        print("Skipping python migrations since SENTRY_DEVENV_FRONTEND_ONLY is set.")
        return 0

    # Even with nothing to apply, migrating boots Django. The lockfile only names sentry's
    # own apps, so a new uv.lock also migrates, for Django's and other packages' migrations.
    migrated_with = digest(f"{reporoot}/uv.lock")
    if stamped(reporoot, "migrations", migrated_with) and migrations_applied(
        migrated_databases(), (f"{reporoot}/migrations_lockfile.txt",)
    ):
        print("✅ python migrations (up to date)")
        return 0

    proc.run(
        (f"{venv_dir}/bin/devservices", "up", "--mode", "migrations"),
        pathprepend=f"{reporoot}/.devenv/bin",
        exit=True,
    )

    if not run_procs(
        reporoot,
        venv_dir,
        (
            (
                "python migrations",
                (f"{venv_dir}/bin/python", "-m", "tools.dev_db", "migrate"),
                {},
            ),
        ),
        verbose,
    ):
        return 1
    stamp(reporoot, "migrations", migrated_with)

    return 0
