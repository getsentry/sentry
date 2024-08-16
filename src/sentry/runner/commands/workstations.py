from __future__ import annotations

import shutil
import socket
import subprocess
import sys
import threading
import time
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from string import Template
from typing import Any, TextIO

import click

GCLOUD_BIN = "gcloud"
POLLING_INTERVAL = 30
TIMEOUT = 12000

NAME_ARG_ATTRS: dict[str, Any] = {
    "metavar": "WORKSTATION_NAME",
    "type": click.STRING,
    "required": True,
}
CONFIG_OPT_ATTRS: dict[str, Any] = {
    "help": """The remote config to be applied to this workstation at creation time. Inherits the
               value of the `SENTRY_WORKSTATION_CONFIG` environment variable.""",
    "envvar": "SENTRY_WORKSTATION_CONFIG",
    "metavar": "CONFIG_NAME",
    "type": click.STRING,
    "required": True,
}
PROJECT_OPT_ATTRS: dict[str, Any] = {
    "help": """The GCP project this command is affecting. Inherits the value of the
               `SENTRY_WORKSTATION_PROJECT` environment variable.""",
    "envvar": "SENTRY_WORKSTATION_PROJECT",
    "metavar": "PROJECT_NAME",
    "type": click.STRING,
    "required": True,
}

ERR_BIN_NOT_FOUND = "The `gcloud` command line binary could not be found."
ERR_TIMEOUT = "An underlying `gcloud` call timed out."
ERR_LOGGED_OUT = Template("The `gcloud` binary does not appear to be logged in: $e")


@dataclass(frozen=True)
class WorkstationConfig:
    """
    All of the useful information we might need about a particular workstations configuration and deployment localization.
    """

    config: str
    project: str
    region: str
    cluster: str
    machine: str

    @classmethod
    def from_string(cls, data: str, project: str) -> WorkstationConfig:
        """
        Given a space-separated 4-tuple string specifying a `CONFIG CLUSTER REGION MACHINE_TYPE`,
        return those as a `WorkstationConfig` object. Extra items in the string beyond this leading
        4-tuple are discarded.
        """

        (config, cluster, region, machine) = data.split()[:4]
        return WorkstationConfig(
            config=config,
            project=project,
            region=region,
            cluster=cluster,
            machine=machine,
        )


class WorkstationsException(Exception):
    pass


class GCPAccount:
    """
    Represents the currently logged in `gcloud` user.
    """

    def __init__(self, email: str) -> None:
        self.email = email


class WorkstationState(str, Enum):
    """
    The current remote state of the workstation, as defined by GCP at
    https://cloud.google.com/python/docs/reference/workstations/latest/google.cloud.workstations_v1.types.Workstation.State.
    """

    UNSPECIFIED = "UNSPECIFIED"
    STARTING = "STARTING"
    RUNNING = "RUNNING"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"

    @classmethod
    def from_string(cls, st: str) -> WorkstationState:
        return WorkstationState[st.removeprefix("STATE_")]


@dataclass(frozen=True)
class WorkstationInfo:
    """
    An existing workstation, with its current status (stopped or running) included. The info is
    immutable - to update it, pull the latest information from the server and create a new instance.
    """

    name: str
    state: WorkstationState
    config: WorkstationConfig


def _sync_gcloud_workstation_cmd(
    args: list[str],
    *,
    scope: str | WorkstationConfig | None = None,
    passthrough: list[str] | None = None,
    timeout: int | None = None,
    silence_stderr: bool = False,
) -> subprocess.CompletedProcess[str]:
    """
    Runs a `gcloud ...` command synchronously, returning when the command completes.

    The `scope` argument is either a `--project` ID for this command, a full `WorkstationConfig` for
    workstation commands that require it, or omitted in cases where none of these are necessary.
    """

    cmd = [
        GCLOUD_BIN,
    ]
    cmd.extend(args)
    if scope is not None:
        if isinstance(scope, str):
            cmd.extend(
                [
                    "--project",
                    scope,
                ]
            )
        else:
            cmd.extend(
                [
                    "--project",
                    scope.project,
                    "--region",
                    scope.region,
                    "--cluster",
                    scope.cluster,
                    "--config",
                    scope.config,
                ]
            )

    # Prevent interactive operation, and passthrough further arguments to commands that accept them.
    cmd.append("--quiet")
    if passthrough:
        cmd.append("--")
        cmd.extend(passthrough)

    # The reauthentication prompt from `gcloud` ignores the `--quiet` flag, so we have to manually
    # check whether or not the prompt appears. See: https://issuetracker.google.com/issues/67053406.
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=sys.stdin,
        encoding="utf-8",
        text=True,
    )

    # Record output.
    stdout = ""
    stderr = ""

    def capture_stdout(pipe: TextIO) -> None:
        for line in iter(pipe.readline, ""):
            nonlocal stdout
            stdout += line

    def capture_stderr(pipe: TextIO) -> None:
        for line in iter(pipe.readline, ""):
            nonlocal stderr, proc, silence_stderr
            stderr += line
            if not silence_stderr:
                sys.stdout.write(line)
                sys.stdout.flush()

    # Create and start threads to capture stdout and stderr separately.
    stdout_thread = threading.Thread(target=capture_stdout, args=(proc.stdout,))
    stderr_thread = threading.Thread(target=capture_stderr, args=(proc.stderr,))
    stdout_thread.start()
    stderr_thread.start()

    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.terminate()
        raise

    stdout_thread.join()
    stderr_thread.join()
    if proc.returncode != 0:
        raise subprocess.CalledProcessError(
            proc.returncode,
            proc.args,
            output=stdout,
            stderr=stderr,
        )

    return subprocess.CompletedProcess(proc.args, proc.returncode, stdout=stdout, stderr=stderr)


def _check_gcloud_setup(project: str) -> GCPAccount:
    """
    Helper function that ensures that this user has the `gcloud` binary accessible in their current
    `$PATH`. Returns the email of the account currently logged into `gcloud`.
    """

    if shutil.which(GCLOUD_BIN) is None:
        raise WorkstationsException(ERR_BIN_NOT_FOUND)

    try:
        result = _sync_gcloud_workstation_cmd(
            [
                "config",
                "list",
                "--format",
                "value(core.account)",
            ],
            scope=project,
            timeout=10,
        )
    except subprocess.CalledProcessError as e:
        raise WorkstationsException(ERR_LOGGED_OUT.substitute(e=e))
    except subprocess.TimeoutExpired:
        click.echo(message=ERR_TIMEOUT, err=True)

    return GCPAccount(result.stdout.strip())


def _get_workstation_config(*, project: str, config: str) -> WorkstationConfig:
    """
    Helper function that pulls down the specific named config.
    """

    found = next((c for c in _configs(project) if c.config == config), None)
    if found is None:
        raise WorkstationsException(f"Could not find the {config} config in project {project}")

    return found


def _notify(text: str) -> None:
    """
    Prints simple status updates to the console in a highlighted style.
    """

    lines = text.splitlines()
    if len(lines) == 0:
        return

    head = lines[0]
    tail = lines[1:]
    click.echo(click.style(f"➤  {head}", bold=True, italic=True, fg="cyan"))
    for line in tail:
        click.echo(click.style(f"   {line.strip()}", bold=True, fg="cyan"))


def _get_workstation_info(name: str, conf: WorkstationConfig) -> WorkstationInfo | None:
    """
    Pull down the latest information for a given workstation.
    """

    result = _sync_gcloud_workstation_cmd(
        [
            "workstations",
            "list",
            "--filter",
            f"NAME ~ '{name}$' AND CLUSTER ~ '{conf.cluster}'",
            "--format",
            "csv[no-heading](CONFIG,STATE)",
        ],
        scope=conf.project,
        timeout=10,
    )
    lines = result.stdout.splitlines()
    if len(lines) == 0:
        return None
    if len(lines) > 2:
        raise WorkstationsException(
            f"Encountered multiple workstations with the same name '{name}'"
        )

    (_, state) = lines[0].split(",")
    return WorkstationInfo(
        name=name,
        state=WorkstationState.from_string(state),
        config=conf,
    )


def _get_open_port() -> int:
    """
    Finds a random open port between 1024 and 65535.
    """

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("", 0))
    _, port = s.getsockname()
    s.close()
    return port


@contextmanager
def gcloud_manager(ctx: click.Context, project: str) -> Generator[None]:
    """
    Handles call(s) into the `gcloud` binary gracefully.
    """

    try:
        _check_gcloud_setup(project)
        yield
        ctx.exit(0)
    except WorkstationsException as e:
        click.echo(message=str(e), err=True)
        ctx.exit(1)
    except subprocess.CalledProcessError:
        # Assumes that piping the output from the `gcloud` command(s) to the shell is sufficient for
        # error reporting to the user.
        ctx.exit(2)
    except subprocess.TimeoutExpired:
        click.echo(message=ERR_TIMEOUT, err=True)
        ctx.exit(3)


@click.group()
def workstations() -> None:
    """
    Create a bespoke Google Cloud Workstation instance.

    NOTE: THIS IS CURRENTLY AN ALPHA STAGE COMMAND! If you are a Sentry dev, you'll need explicit
    permissions from the OSPO team to spin up a workstation. Please reach out to us on
    #discuss-self-hosted - we'd be happy to get you set up! :)

    This command is primarily intended for Sentry employees working on self-hosted. To learn more
    about how to set this up, check out
    https://github.com/getsentry/self-hosted/blob/master/workstation/README.md.

    The `workstations` command requires that the `gcloud` command line utility at version >=464.0 be
    installed and visible from its `$PATH`.

    The tool requires two configuration values: a `project` specifying the GCP project that owns the
    desired workstation(s), and a `config` that provisions them with it. These can be set in the
    following ways, listed in order of precedence:

        1. Via flags passed to the requested subcommand, ex: `sentry workstations create my_machine
            --project=my_proj --config=my_config`.

        2. Via `SENTRY_WORKSTATION_`-prefixed environment variables, ex:
           `SENTRY_WORKSTATION_PROJECT=my_proj sentry
            workstations create my_machine --config=my_config`.

    Note that this command will NOT honor your `gcloud config set project` setting - you must use
    one of the two methods described above to set the project.
    """


@workstations.command(
    help="Lists all available configs that can be used when creating a new workstation.",
)
@click.option("--project", **PROJECT_OPT_ATTRS)
@click.pass_context
def configs(ctx: click.Context, project: str) -> None:
    with gcloud_manager(ctx, project):
        _configs(project, echo=True)


def _configs(project: str, *, echo: bool = False) -> list[WorkstationConfig]:
    result = _sync_gcloud_workstation_cmd(
        [
            "workstations",
            "configs",
            "list",
            "--format",
            "table(NAME,CLUSTER,REGION,'MACHINE TYPE')",
        ],
        scope=project,
        timeout=10,
    )
    if echo:
        click.echo(result.stdout.strip())

    lines = result.stdout.strip().splitlines()[1:]
    return [WorkstationConfig.from_string(line, project) for line in lines]


@workstations.command(
    help="""Creates a new workstation by name, specifying an optional remote configuration.

    This process can take up to 20 minutes, and automatically connects to the newly created instance
    as soon as it is finished.
    """,
)
@click.argument("name", **NAME_ARG_ATTRS)
@click.option("--project", **PROJECT_OPT_ATTRS)
@click.option("--config", **CONFIG_OPT_ATTRS)
@click.pass_context
def create(ctx: click.Context, name: str, project: str, config: str) -> None:
    with gcloud_manager(ctx, project):
        conf = _get_workstation_config(project=project, config=config)

        # If this workstation already exists, inform the user and connect to it.
        info = _get_workstation_info(name, conf)
        if info is not None:
            _notify(f"A workstation named {name} already exists, connecting to it now.")
            return _connect(name, conf)

        # Create the workstation, then connect to it.
        _notify(
            f"""Provisioning a new workstation {name}, this could take a few minutes...
            Project: {conf.project}
            Region: {conf.region}
            Cluster: {conf.cluster}
            Config: {conf.config}
            Machine: {conf.machine}
            """
        )
        _sync_gcloud_workstation_cmd(
            ["workstations", "create", name],
            scope=conf,
            timeout=30,
        )
        _connect(name, conf)


@workstations.command(
    help="""Connects to an already created workstation by name.

    The connection is managed over a TCP tunnel run in a detached daemon process.
    """,
)
@click.argument("name", **NAME_ARG_ATTRS)
@click.option("--project", **PROJECT_OPT_ATTRS)
@click.option("--config", **CONFIG_OPT_ATTRS)
@click.pass_context
def connect(ctx: click.Context, name: str, project: str, config: str) -> None:
    with gcloud_manager(ctx, project):
        _connect(name, _get_workstation_config(project=project, config=config))


# We need to call this function recursively, so create a separate non-`click`-ified inner function
# to do the actual work.
def _connect(name: str, conf: WorkstationConfig, started_at: datetime | None = None) -> None:
    if started_at is None:
        started_at = datetime.now()
    if datetime.now().timestamp() - started_at.timestamp() > TIMEOUT:
        raise WorkstationsException(f"Timed out after {TIMEOUT} seconds")

    # Make sure this workstation is exists and has already started before proceeding.
    info = _get_workstation_info(name, conf)
    if info is None:
        raise WorkstationsException(
            f"Workstation {name} does not exist in the {conf.cluster} cluster and of the {conf.region} region"
        )

    # TODO(getsentry/team-ospo#240): Switch to pattern matching when that is available.
    if info.state == WorkstationState.UNSPECIFIED:
        raise WorkstationsException(f"The workstation {name} is in a corrupted state.")
    elif info.state == WorkstationState.STOPPED or info.state == WorkstationState.STOPPING:
        _sync_gcloud_workstation_cmd(["workstations", "start", name, "--async"], scope=conf)
        _notify(f"Starting up your workstation {name}, this could take a few minutes...")
        # A bit hacky, since we can stack overflow if `TIMEOUT/POLLING_INTERVAL` is large enough.
        # Solution: just don't make it too large ;)
        time.sleep(POLLING_INTERVAL)
        return _connect(name, conf, started_at)
    elif info.state == WorkstationState.STARTING:
        # Wait for an already requested startup to complete.
        _notify(f"Waiting for workstation {name} to start up, this could take a few minutes...")
        # Ditto re: hackiness (see case above).
        time.sleep(POLLING_INTERVAL)
        return _connect(name, conf, started_at)
    elif info.state == WorkstationState.RUNNING:
        pass

    # The workstation has started, but that is not sufficient to ensure that startup is successful.
    # Cloud Workstations will let us SSH in as soon as the Dockerfile setup has completed, even if
    # our setup script (and by extension, `install.sh`) has not yet finished running. Luckily, the
    # setup script is configured to leave a `.sentry.workstation.remote` dotfile in the `~/`
    # directory for the workstation when this script has run, so we just need to poll until this
    # occurs (or otherwise timeout).
    ssh_started_at = datetime.now().timestamp()
    result = _sync_gcloud_workstation_cmd(
        [
            "workstations",
            "ssh",
            name,
            "--command",
            "[ -f /home/user/.sentry.workstation.remote ] && echo 'Y' || echo 'N'",
        ],
        scope=conf,
        timeout=15,
        # `ssh` args to silence terminal output.
        passthrough=[
            "-o",
            "UserKnownHostsFile=/dev/null",
            "-o",
            "LogLevel ERROR",
        ],
        silence_stderr=True,
    )
    if result.returncode != 0:
        raise WorkstationsException(f"Unable to establish SSH connection with workstation {name}")

    output_lines = result.stdout.strip().split("\n")
    last_line = output_lines[-1] if output_lines else ""
    if last_line != "Y" and last_line != "N":
        raise WorkstationsException(
            f"Could not confirm that workstation {name} started up successfully"
        )
    if last_line == "N":
        _notify(f"Workstation {name} finishing installation, this may take up to 15 minutes...")
        time_to_sleep = POLLING_INTERVAL - (datetime.now().timestamp() - ssh_started_at)
        if time_to_sleep > 0:
            time.sleep(time_to_sleep)
            return _connect(name, conf, started_at)

    # Everything has started up successfully! Create a detached process to manage the TCP tunnel.
    localhost_port = _get_open_port()
    subprocess.Popen(
        [
            GCLOUD_BIN,
            "workstations",
            "start-tcp-tunnel",
            name,
            "22",
            "--local-host-port",
            f"localhost:{str(localhost_port)}",
            "--project",
            conf.project,
            "--region",
            conf.region,
            "--cluster",
            conf.cluster,
            "--config",
            conf.config,
        ],
        close_fds=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    _notify(
        f"""Connected to workstation {name} over user@localhost:{localhost_port}. What's next?

            - Connect in VSCode via your client instance's `Remote SSH: Connect to Host...` command:
              * When asked for a user, enter `user@localhost:{localhost_port}`
              * Navigate to the `sentry` or `self-hosted` directories, which are pre-installed.

            - Authenticate via GitHub using this machine's already-installed `gh` tool.
              * You'll need to create a fine-grained access-token to push new commits.

            - Attach a terminal to this machine over SSH.
              * You can connect to this workstation using `ssh -p {localhost_port} user@localhost`.

            - Sync your VSCode and Git configurations using the `sentry workstations sync` command.
              * COMING SOON!

            Happy hacking!
            """
    )
