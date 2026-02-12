"""CLI interface for managing Sentry development sandboxes.

Usage:
    # Create and get sandbox ID
    sentry-sandbox create --tag nightly
    # => sandbox-a1b2c3d4

    # Execute a command
    sentry-sandbox exec sandbox-a1b2c3d4 -- pytest -xvs tests/sentry/api/test_base.py

    # Copy files in/out
    sentry-sandbox cp sandbox-a1b2c3d4 --in src/sentry/api/foo.py ./local/foo.py
    sentry-sandbox cp sandbox-a1b2c3d4 --out /workspace/results.xml ./results.xml

    # View logs
    sentry-sandbox logs sandbox-a1b2c3d4

    # Destroy
    sentry-sandbox destroy sandbox-a1b2c3d4

    # One-shot: create, exec, destroy
    sentry-sandbox run --tag nightly -- pytest -xvs tests/sentry/api/test_base.py
"""

from __future__ import annotations

import json
import logging
import sys

import click

from sentry_sandbox.sandbox import Sandbox

# Global state: track active sandboxes by ID for the CLI session
_active_sandboxes: dict[str, Sandbox] = {}

logger = logging.getLogger("sentry_sandbox")


@click.group()
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose logging")
def main(verbose: bool) -> None:
    """Manage Sentry development sandboxes."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format="%(levelname)s: %(message)s")


@main.command()
@click.option("--tag", "-t", default="nightly", help="Image tag (default: nightly)")
@click.option("--postgres-tag", default=None, help="Override postgres image tag")
@click.option("--cpus", default="4", help="CPU limit (default: 4)")
@click.option("--memory", default="4g", help="Memory limit (default: 4g)")
@click.option("--ttl", default=1800, type=int, help="Max lifetime in seconds (default: 1800)")
@click.option("--isolated/--no-isolated", default=False, help="Network isolation")
@click.option("--overlay", default=None, help="Local directory to overlay on /workspace")
@click.option("--json-output", is_flag=True, help="Output as JSON")
def create(
    tag: str,
    postgres_tag: str | None,
    cpus: str,
    memory: str,
    ttl: int,
    isolated: bool,
    overlay: str | None,
    json_output: bool,
) -> None:
    """Create and start a new sandbox."""
    sb = Sandbox.create(
        tag=tag,
        postgres_tag=postgres_tag,
        cpus=cpus,
        memory=memory,
        ttl_seconds=ttl,
        network_isolated=isolated,
        workspace_overlay=overlay,
    )
    sb.start()

    if json_output:
        click.echo(json.dumps({"sandbox_id": sb.id, "status": "running"}))
    else:
        click.echo(sb.id)


@main.command("exec")
@click.argument("sandbox_id")
@click.argument("command", nargs=-1, required=True)
@click.option("--timeout", "-T", default=None, type=int, help="Command timeout in seconds")
@click.option("--workdir", "-w", default=None, help="Working directory")
@click.option("--json-output", is_flag=True, help="Output as JSON")
def exec_cmd(
    sandbox_id: str,
    command: tuple[str, ...],
    timeout: int | None,
    workdir: str | None,
    json_output: bool,
) -> None:
    """Execute a command in a sandbox."""
    sb = _get_or_attach(sandbox_id)
    cmd_str = " ".join(command)

    result = sb.exec(cmd_str, timeout=timeout, workdir=workdir)

    if json_output:
        click.echo(json.dumps({
            "exit_code": result.exit_code,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "duration_seconds": result.duration_seconds,
        }))
    else:
        if result.stdout:
            click.echo(result.stdout, nl=False)
        if result.stderr:
            click.echo(result.stderr, nl=False, err=True)

    sys.exit(result.exit_code)


@main.command()
@click.argument("sandbox_id")
@click.option("--in", "copy_in", nargs=2, type=str, help="Copy local file into sandbox: --in CONTAINER_PATH LOCAL_PATH")
@click.option("--out", "copy_out", nargs=2, type=str, help="Copy file from sandbox: --out CONTAINER_PATH LOCAL_PATH")
def cp(sandbox_id: str, copy_in: tuple[str, str] | None, copy_out: tuple[str, str] | None) -> None:
    """Copy files in/out of a sandbox."""
    sb = _get_or_attach(sandbox_id)

    if copy_in:
        container_path, local_path = copy_in
        sb.copy_in(container_path, local_path)
        click.echo(f"Copied {local_path} -> {sandbox_id}:{container_path}")

    if copy_out:
        container_path, local_path = copy_out
        sb.copy_out(container_path, local_path)
        click.echo(f"Copied {sandbox_id}:{container_path} -> {local_path}")

    if not copy_in and not copy_out:
        click.echo("Specify --in or --out", err=True)
        sys.exit(1)


@main.command()
@click.argument("sandbox_id")
@click.option("--service", "-s", default="agent", help="Service to get logs from")
@click.option("--tail", "-n", default=100, type=int, help="Number of lines")
def logs(sandbox_id: str, service: str, tail: int) -> None:
    """View logs from a sandbox service."""
    sb = _get_or_attach(sandbox_id)
    output = sb.logs(service=service, tail=tail)
    click.echo(output)


@main.command()
@click.argument("sandbox_id")
def destroy(sandbox_id: str) -> None:
    """Destroy a sandbox."""
    sb = _get_or_attach(sandbox_id)
    sb.destroy()
    click.echo(f"Destroyed {sandbox_id}")


@main.command()
@click.option("--tag", "-t", default="nightly", help="Image tag")
@click.option("--timeout", "-T", default=None, type=int, help="Command timeout in seconds")
@click.option("--json-output", is_flag=True, help="Output as JSON")
@click.argument("command", nargs=-1, required=True)
def run(tag: str, timeout: int | None, json_output: bool, command: tuple[str, ...]) -> None:
    """One-shot: create sandbox, run command, destroy sandbox.

    Exit code matches the command's exit code.
    """
    cmd_str = " ".join(command)

    with Sandbox.create(tag=tag) as sb:
        click.echo(f"Sandbox: {sb.id}", err=True)
        result = sb.exec(cmd_str, timeout=timeout)

    if json_output:
        click.echo(json.dumps({
            "sandbox_id": sb.id,
            "exit_code": result.exit_code,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "duration_seconds": result.duration_seconds,
        }))
    else:
        if result.stdout:
            click.echo(result.stdout, nl=False)
        if result.stderr:
            click.echo(result.stderr, nl=False, err=True)

    sys.exit(result.exit_code)


def _get_or_attach(sandbox_id: str) -> Sandbox:
    """Get a sandbox by ID, creating a handle if needed.

    This re-attaches to an existing Docker Compose project by ID.
    The sandbox must have been created with `sentry-sandbox create`.
    """
    if sandbox_id in _active_sandboxes:
        return _active_sandboxes[sandbox_id]

    # Create a handle that points to the existing Docker Compose project
    from sentry_sandbox.sandbox import SandboxConfig

    sb = Sandbox(sandbox_id, SandboxConfig())
    sb._started = True  # Assume it's running if we're attaching
    _active_sandboxes[sandbox_id] = sb
    return sb


if __name__ == "__main__":
    main()
