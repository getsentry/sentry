from __future__ import annotations

import argparse
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from collections.abc import Sequence

from devenv.lib import brew, colima, config, fs, limactl, proc

from devenv import constants

# Hook types prek installs by default (see .pre-commit-config.yaml
# default_install_hook_types). Cursor's agent-hooks dispatcher only invokes
# hook names that exist as shims in its hooksPath dir.
_CLOUD_PREK_HOOK_TYPES = ("pre-commit", "pre-push")


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse repo-local sync flags.

    The installed `devenv sync` entrypoint does not forward argv into this
    module, so we also accept flags from ``sys.argv`` (e.g. ``devenv sync --cloud``).
    """
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument(
        "--cloud",
        action="store_true",
        help=(
            "Install prek git hooks alongside Cursor Cloud agent-hooks "
            "(core.hooksPath). Use this when plain `prek install` refuses "
            "because core.hooksPath is set."
        ),
    )
    args, _ = parser.parse_known_args(list(argv) if argv is not None else sys.argv[1:])
    return args


def _absolute_git_dir(reporoot: str) -> str:
    return subprocess.check_output(
        ("git", "-C", reporoot, "rev-parse", "--absolute-git-dir"),
        text=True,
    ).strip()


def _find_cursor_agent_hooks_dir() -> str | None:
    """Return Cursor Cloud's agent-hooks dispatcher directory, if present."""
    agent_hooks_root = os.path.join(constants.home, ".cursor", "agent-hooks")
    if not os.path.isdir(agent_hooks_root):
        return None

    for entry in sorted(os.listdir(agent_hooks_root)):
        candidate = os.path.join(agent_hooks_root, entry)
        if os.path.isfile(os.path.join(candidate, ".dispatcher")):
            return candidate
    return None


def ensure_cloud_prek_hooks(reporoot: str, venv_dir: str) -> bool:
    """Install prek hooks so they run under Cursor Cloud's hooksPath.

    Cursor Cloud sets ``core.hooksPath`` to ``~/.cursor/agent-hooks/<id>/`` and
    chains to the path in ``.cursor-original-hooks-path``. ``prek install``
    refuses when ``core.hooksPath`` is set, so we:

    1. Install prek shims into the real git hooks dir via ``--git-dir``
    2. Point Cursor's original-hooks path at that dir
    3. Ensure Cursor has dispatcher shims for the hook types we care about
    """
    print("⏳ prek dependencies (cloud)")
    git_dir = _absolute_git_dir(reporoot)
    git_hooks_dir = os.path.join(git_dir, "hooks")
    prek = os.path.join(venv_dir, "bin", "prek")

    install_cmd = (
        prek,
        "install",
        "--prepare-hooks",
        "-f",
        "--git-dir",
        git_dir,
    )
    try:
        subprocess.check_call(install_cmd, cwd=reporoot)
    except (OSError, subprocess.CalledProcessError) as e:
        print(
            f"❌ prek dependencies (cloud)\n\nfailed command:\n    {shlex.join(install_cmd)}\n\n{e}\n"
        )
        return False

    agent_hooks_dir = _find_cursor_agent_hooks_dir()
    if agent_hooks_dir is None:
        print(
            "⚠️  Cursor agent-hooks not found; installed prek into "
            f"{git_hooks_dir} but could not wire Cursor's dispatcher. "
            "Git hooks will only run if core.hooksPath points at that directory."
        )
        print("✅ prek dependencies (cloud)")
        return True

    current_hooks_path = subprocess.run(
        ("git", "-C", reporoot, "config", "--get", "core.hooksPath"),
        check=False,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if current_hooks_path != agent_hooks_dir:
        subprocess.check_call(("git", "-C", reporoot, "config", "core.hooksPath", agent_hooks_dir))
        print(f"   restored core.hooksPath -> {agent_hooks_dir}")

    orig_path_file = os.path.join(agent_hooks_dir, ".cursor-original-hooks-path")
    try:
        with open(orig_path_file) as f:
            current_orig = f.read().strip()
    except OSError:
        current_orig = ""
    if current_orig != git_hooks_dir:
        with open(orig_path_file, "w") as f:
            f.write(git_hooks_dir)
        print(f"   set .cursor-original-hooks-path -> {git_hooks_dir}")

    for hook_type in _CLOUD_PREK_HOOK_TYPES:
        target = os.path.join(agent_hooks_dir, hook_type)
        if os.path.islink(target) and os.readlink(target) == ".dispatcher":
            continue
        if os.path.exists(target) or os.path.islink(target):
            os.remove(target)
        os.symlink(".dispatcher", target)
        print(f"   linked {hook_type} -> .dispatcher")

    print("✅ prek dependencies (cloud)")
    return True


# TODO: need to replace this with a nicer process executor in devenv.lib
def run_procs(
    repo: str,
    reporoot: str,
    venv_path: str,
    _procs: tuple[tuple[str, tuple[str, ...], dict[str, str]], ...],
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
    with urllib.request.urlopen(
        "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json"
    ) as r:
        versions = json.load(r)["versions"]

    entry = next(
        (
            v
            for v in reversed(versions)
            if v["version"].split(".")[0] == major and "chromedriver" in v["downloads"]
        ),
        None,
    )
    if not entry:
        print(f"no ChromeDriver release found for Chrome {major}.x")
        return 1

    url = next(
        (d["url"] for d in entry["downloads"]["chromedriver"] if d["platform"] == "mac-arm64"), None
    )
    if not url:
        print(f"no mac-arm64 ChromeDriver download available for {entry['version']}")
        return 1

    try:
        if (
            subprocess.check_output([install, "--version"], text=True).split()[1]
            == entry["version"]
        ):
            return 0
    except (FileNotFoundError, subprocess.CalledProcessError, IndexError):
        pass

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

    stdout = proc.run((f"{binroot}/pnpm", "--version"), stdout=True)
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


def main(context: dict[str, str], argv: Sequence[str] | None = None) -> int:
    repo = context["repo"]
    reporoot = context["reporoot"]
    cfg = config.get_repo(reporoot)
    args = _parse_args(argv)

    # TODO: context["verbose"]
    verbose = os.environ.get("SENTRY_DEVENV_VERBOSE") is not None

    FRONTEND_ONLY = os.environ.get("SENTRY_DEVENV_FRONTEND_ONLY") is not None
    SKIP_FRONTEND = os.environ.get("SENTRY_DEVENV_SKIP_FRONTEND") is not None
    IN_GIT_WORKTREE = os.path.isfile(f"{reporoot}/.git")
    CLOUD = args.cloud or os.environ.get("SENTRY_DEVENV_CLOUD") is not None

    if constants.DARWIN:
        brew.install()

        proc.run(
            (f"{constants.homebrew_bin}/brew", "bundle"),
            cwd=reporoot,
        )

    if constants.DARWIN and os.path.exists(f"{constants.root}/bin/colima"):
        binroot = f"{reporoot}/.devenv/bin"
        colima.uninstall(binroot)
        limactl.uninstall(binroot)

    if os.path.exists(f"{reporoot}/.devenv/bin/uv"):
        os.remove(f"{reporoot}/.devenv/bin/uv")

    if os.path.exists(f"{reporoot}/.devenv/bin/uvx"):
        os.remove(f"{reporoot}/.devenv/bin/uvx")

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

    if not SKIP_FRONTEND and not run_procs(
        repo,
        reporoot,
        venv_dir,
        (
            (
                # Spreading out the network load by installing js,
                # then py in the next batch.
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
            ),
        ),
        verbose,
    ):
        return 1

    if not run_procs(
        repo,
        reporoot,
        venv_dir,
        (
            # could opt out of syncing python if FRONTEND_ONLY but only if repo-local devenv
            # and prek were moved to inside devenv and not the sentry venv
            (
                "python dependencies",
                (
                    "uv",
                    "sync",
                    "--frozen",
                    # don't uninstall sentry/getsentry fast_editable shims
                    "--inexact",
                    "--quiet",
                    "--active",
                ),
                {},
            ),
        ),
        verbose,
    ):
        return 1

    if CLOUD:
        if not ensure_cloud_prek_hooks(reporoot, venv_dir):
            return 1
        if not run_procs(
            repo,
            reporoot,
            venv_dir,
            (("fast editable", ("python3", "-m", "tools.fast_editable", "--path", "."), {}),),
            verbose,
        ):
            return 1
    elif not run_procs(
        repo,
        reporoot,
        venv_dir,
        (
            ("prek dependencies", ("prek", "install", "--prepare-hooks", "-f"), {}),
            ("fast editable", ("python3", "-m", "tools.fast_editable", "--path", "."), {}),
        ),
        verbose,
    ):
        return 1

    # Agent skills are non-fatal — private skill repos may not be accessible in CI
    if os.path.exists(f"{reporoot}/agents.toml") and shutil.which(
        "pnpm", path=f"{reporoot}/.devenv/bin"
    ):
        if not run_procs(
            repo,
            reporoot,
            venv_dir,
            (("agent skills", ("pnpm", "dlx", "@sentry/dotagents", "install"), {}),),
            verbose,
        ):
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

    # Frontend engineers don't necessarily always have devservices running and
    # can configure to skip them to save on local resources
    if FRONTEND_ONLY:
        print("Skipping python migrations since SENTRY_DEVENV_FRONTEND_ONLY is set.")
        return 0

    proc.run(
        (f"{venv_dir}/bin/devservices", "up", "--mode", "migrations"),
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
        verbose,
    ):
        return 1

    # faster prerequisite check than starting up sentry and running createuser idempotently
    stdout = proc.run(
        (
            "docker",
            "exec",
            "postgres-postgres-1",
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
