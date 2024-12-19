from __future__ import annotations

import contextlib
import functools
import http
import json  # noqa
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Generator
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TYPE_CHECKING, Any, ContextManager, Literal, NamedTuple, overload

import click

if TYPE_CHECKING:
    import docker

CI = os.environ.get("CI") is not None

# assigned as a constant so mypy's "unreachable" detection doesn't fail on linux
# https://github.com/python/mypy/issues/12286
DARWIN = sys.platform == "darwin"

USE_COLIMA = bool(shutil.which("colima")) and os.environ.get("SENTRY_USE_COLIMA") != "0"
USE_ORBSTACK = (
    os.path.exists("/Applications/OrbStack.app") and os.environ.get("SENTRY_USE_ORBSTACK") != "0"
)

if USE_ORBSTACK:
    USE_COLIMA = False

if USE_COLIMA:
    USE_ORBSTACK = False

USE_DOCKER_DESKTOP = not USE_COLIMA and not USE_ORBSTACK

if DARWIN:
    if USE_COLIMA:
        RAW_SOCKET_PATH = os.path.expanduser("~/.colima/default/docker.sock")
    elif USE_ORBSTACK:
        RAW_SOCKET_PATH = os.path.expanduser("~/.orbstack/run/docker.sock")
    elif USE_DOCKER_DESKTOP:
        # /var/run/docker.sock is now gated behind a docker desktop advanced setting
        RAW_SOCKET_PATH = os.path.expanduser("~/.docker/run/docker.sock")
else:
    RAW_SOCKET_PATH = "/var/run/docker.sock"


# Simplified from pre-commit @ fb0ccf3546a9cb34ec3692e403270feb6d6033a2
@functools.cache
def _gitroot() -> str:
    from os.path import abspath
    from subprocess import CalledProcessError, run

    try:
        proc = run(("git", "rev-parse", "--show-cdup"), check=True, capture_output=True)
        root = abspath(proc.stdout.decode().strip())
    except CalledProcessError:
        raise SystemExit(
            "git failed. Is it installed, and are you in a Git repository directory?",
        )
    return root


@contextlib.contextmanager
def get_docker_client() -> Generator[docker.DockerClient]:
    import docker

    def _client() -> ContextManager[docker.DockerClient]:
        return contextlib.closing(docker.DockerClient(base_url=f"unix://{RAW_SOCKET_PATH}"))

    with contextlib.ExitStack() as ctx:
        try:
            client = ctx.enter_context(_client())
        except docker.errors.DockerException:
            if DARWIN:
                if USE_COLIMA:
                    click.echo("Attempting to start colima...")
                    gitroot = _gitroot()
                    subprocess.check_call(
                        (
                            # explicitly use repo-local devenv, not the global one
                            f"{gitroot}/.venv/bin/devenv",
                            "colima",
                            "start",
                        )
                    )
                elif USE_DOCKER_DESKTOP:
                    click.echo("Attempting to start docker...")
                    subprocess.check_call(
                        ("open", "-a", "/Applications/Docker.app", "--args", "--unattended")
                    )
                elif USE_ORBSTACK:
                    click.echo("Attempting to start orbstack...")
                    subprocess.check_call(
                        ("open", "-a", "/Applications/OrbStack.app", "--args", "--unattended")
                    )
            else:
                raise click.ClickException("Make sure docker is running.")

            max_wait = 90
            timeout = time.monotonic() + max_wait

            click.echo(f"Waiting for docker to be ready.... (timeout in {max_wait}s)")
            while time.monotonic() < timeout:
                time.sleep(1)
                try:
                    client = ctx.enter_context(_client())
                except docker.errors.DockerException:
                    continue
                else:
                    break
            else:
                raise click.ClickException("Failed to start docker.")

        yield client


@overload
def get_or_create(
    client: docker.DockerClient, thing: Literal["network"], name: str
) -> docker.models.networks.Network: ...


@overload
def get_or_create(
    client: docker.DockerClient, thing: Literal["volume"], name: str
) -> docker.models.volumes.Volume: ...


def get_or_create(
    client: docker.DockerClient, thing: Literal["network", "volume"], name: str
) -> docker.models.networks.Network | docker.models.volumes.Volume:
    from docker.errors import NotFound

    try:
        return getattr(client, thing + "s").get(name)
    except NotFound:
        click.secho(f"> Creating '{name}' {thing}", err=True, fg="yellow")
        return getattr(client, thing + "s").create(name)


def retryable_pull(
    client: docker.DockerClient, image: str, max_attempts: int = 5, platform: str | None = None
) -> None:
    from docker.errors import APIError

    current_attempt = 0

    # `client.images.pull` intermittently fails in CI, and the docker API/docker-py does not give us the relevant error message (i.e. it's not the same error as running `docker pull` from shell)
    # As a workaround, let's retry when we hit the ImageNotFound exception.
    #
    # See https://github.com/docker/docker-py/issues/2101 for more information
    while True:
        try:
            if platform:
                client.images.pull(image, platform=platform)
            else:
                client.images.pull(image)
        except APIError:
            if current_attempt + 1 >= max_attempts:
                raise
            current_attempt = current_attempt + 1
            continue
        else:
            break


def ensure_interface(ports: dict[str, int | tuple[str, int]]) -> dict[str, tuple[str, int]]:
    # If there is no interface specified, make sure the
    # default interface is 127.0.0.1
    rv = {}
    for k, v in ports.items():
        if not isinstance(v, tuple):
            v = ("127.0.0.1", v)
        rv[k] = v
    return rv


def ensure_docker_cli_context(context: str) -> None:
    # this is faster than running docker context use ...
    config_file = os.path.expanduser("~/.docker/config.json")
    config = {}

    if os.path.exists(config_file):
        with open(config_file, "rb") as f:
            config = json.loads(f.read())

    config["currentContext"] = context

    os.makedirs(os.path.dirname(config_file), exist_ok=True)
    with open(config_file, "w") as f:
        f.write(json.dumps(config))


@click.group()
def devservices() -> None:
    """
    Manage dependent development services required for Sentry.

    Do not use in production!
    """
    # Disable backend validation so no devservices commands depend on like,
    # redis to be already running.
    os.environ["SENTRY_SKIP_BACKEND_VALIDATION"] = "1"

    if CI:
        click.echo("Assuming docker (CI).")
        return

    if DARWIN:
        if USE_DOCKER_DESKTOP:
            click.echo("Using docker desktop.")
            ensure_docker_cli_context("desktop-linux")
        if USE_COLIMA:
            click.echo("Using colima.")
            ensure_docker_cli_context("colima")
        if USE_ORBSTACK:
            click.echo("Using orbstack.")
            ensure_docker_cli_context("orbstack")


@devservices.command()
@click.option("--project", default="sentry")
@click.argument("service", nargs=1)
def attach(project: str, service: str) -> None:
    """
    Run a single devservice in the foreground.

    Accepts a single argument, the name of the service to spawn. The service
    will run with output printed to your terminal, and the ability to kill it
    with ^C. This is used in devserver.

    Note: This does not update images, you will have to use `devservices up`
    for that.
    """
    from sentry.runner import configure

    configure()

    containers = _prepare_containers(project, silent=True)
    if service not in containers:
        raise click.ClickException(f"Service `{service}` is not known or not enabled.")

    with get_docker_client() as docker_client:
        container = _start_service(
            docker_client,
            service,
            containers,
            project,
            always_start=True,
        )

        if container is None:
            raise click.ClickException(f"No containers found for service `{service}`.")

        def exit_handler(*_: Any) -> None:
            try:
                click.echo(f"Stopping {service}")
                container.stop()
                click.echo(f"Removing {service}")
                container.remove()
            except KeyboardInterrupt:
                pass

        signal.signal(signal.SIGINT, exit_handler)
        signal.signal(signal.SIGTERM, exit_handler)

        for line in container.logs(stream=True, since=int(time.time() - 20)):
            click.echo(line, nl=False)


@devservices.command()
@click.argument("services", nargs=-1)
@click.option("--project", default="sentry")
@click.option("--exclude", multiple=True, help="Service to ignore and not run. Repeatable option.")
@click.option(
    "--skip-only-if", is_flag=True, default=False, help="Skip 'only_if' checks for services"
)
@click.option(
    "--recreate", is_flag=True, default=False, help="Recreate containers that are already running."
)
def up(
    services: list[str],
    project: str,
    exclude: list[str],
    skip_only_if: bool,
    recreate: bool,
) -> None:
    """
    Run/update all devservices in the background.

    The default is everything, however you may pass positional arguments to specify
    an explicit list of services to bring up.

    You may also exclude services, for example: --exclude redis --exclude postgres.
    """
    from sentry.runner import configure

    click.secho(
        """
WARNING: We're transitioning from `sentry devservices` to the new and improved `devservices` in January 2025.
To give the new devservices a try, set the `USE_NEW_DEVSERVICES` environment variable to `1`. For a full list of commands, see
https://github.com/getsentry/devservices?tab=readme-ov-file#commands

Instead of running `sentry devservices up`, consider using `devservices up`.
For Sentry employees - if you hit any bumps or have feedback, we'd love to hear from you in #discuss-dev-infra.
Thanks for helping the Dev Infra team improve this experience!

    """,
        fg="yellow",
    )

    configure()

    containers = _prepare_containers(
        project, skip_only_if=(skip_only_if or len(services) > 0), silent=True
    )
    selected_services = set()

    if services:
        for service in services:
            if service not in containers:
                click.secho(
                    f"Service `{service}` is not known or not enabled.\n",
                    err=True,
                    fg="red",
                )
                click.secho(
                    "Services that are available:\n" + "\n".join(containers.keys()) + "\n", err=True
                )
                raise click.Abort()
            selected_services.add(service)
    else:
        selected_services = set(containers.keys())

    for service in exclude:
        if service not in containers:
            click.secho(f"Service `{service}` is not known or not enabled.\n", err=True, fg="red")
            click.secho(
                "Services that are available:\n" + "\n".join(containers.keys()) + "\n", err=True
            )
            raise click.Abort()
        selected_services.remove(service)

    with get_docker_client() as docker_client:
        get_or_create(docker_client, "network", project)

        with ThreadPoolExecutor(max_workers=len(selected_services)) as executor:
            futures = []
            for name in selected_services:
                futures.append(
                    executor.submit(
                        _start_service,
                        docker_client,
                        name,
                        containers,
                        project,
                        False,
                        recreate,
                    )
                )
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    click.secho(f"> Failed to start service: {e}", err=True, fg="red")
                    raise

    # Check health of services. Seperate from _start_services
    # in case there are dependencies needed for the health
    # check (for example: kafka's healthcheck requires zookeeper)
    with ThreadPoolExecutor(max_workers=len(selected_services)) as executor:
        futures = []
        for name in selected_services:
            futures.append(
                executor.submit(
                    check_health,
                    name,
                    containers[name],
                )
            )
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                click.secho(f"> Failed to check health: {e}", err=True, fg="red")
                raise


def _prepare_containers(
    project: str, skip_only_if: bool = False, silent: bool = False
) -> dict[str, Any]:
    from django.conf import settings

    from sentry import options as sentry_options

    containers = {}

    for name, option_builder in settings.SENTRY_DEVSERVICES.items():
        options = option_builder(settings, sentry_options)
        only_if = options.pop("only_if", True)

        if not skip_only_if and not only_if:
            if not silent:
                click.secho(f"! Skipping {name} due to only_if condition", err=True, fg="cyan")
            continue

        options["network"] = project
        options["detach"] = True
        options["name"] = project + "_" + name
        options.setdefault("ports", {})
        options.setdefault("environment", {})
        # set policy to unless-stopped to avoid automatically restarting containers on boot
        # this is important given you can start multiple sets of containers that can conflict
        # with each other
        options.setdefault("restart_policy", {"Name": "unless-stopped"})
        options["ports"] = ensure_interface(options["ports"])
        options["extra_hosts"] = {"host.docker.internal": "host-gateway"}
        containers[name] = options

    # keys are service names
    # a service has 1 container exactly, the container name being value["name"]
    return containers


@overload
def _start_service(
    client: docker.DockerClient,
    name: str,
    containers: dict[str, Any],
    project: str,
    always_start: Literal[False] = ...,
    recreate: bool = False,
) -> docker.models.containers.Container: ...


@overload
def _start_service(
    client: docker.DockerClient,
    name: str,
    containers: dict[str, Any],
    project: str,
    always_start: bool = False,
    recreate: bool = False,
) -> docker.models.containers.Container | None: ...


def _start_service(
    client: docker.DockerClient,
    name: str,
    containers: dict[str, Any],
    project: str,
    always_start: bool = False,
    recreate: bool = False,
) -> docker.models.containers.Container | None:
    from docker.errors import NotFound

    options = containers[name]

    # If a service is associated with the devserver, then do not run the created container.
    # This was mainly added since it was not desirable for nginx to occupy port 8000 on the
    # first "devservices up".
    # Nowadays that nginx is gone again, it's still nice to be able to shut
    # down services within devserver.
    # See https://github.com/getsentry/sentry/pull/18362#issuecomment-616785458
    with_devserver = options.pop("with_devserver", False)

    # Two things call _start_service.
    # devservices up, and devservices attach.
    # Containers that should be started on-demand with devserver
    # should ONLY be started via the latter, which sets `always_start`.
    if with_devserver and not always_start:
        click.secho(
            f"> Not starting container '{options['name']}' because it should be started on-demand with devserver.",
            fg="yellow",
        )
        # XXX: if always_start=False, do not expect to have a container returned 100% of the time.
        return None

    container = None
    try:
        container = client.containers.get(options["name"])
    except NotFound:
        pass

    if container is not None:
        if not recreate and container.status == "running":
            click.secho(f"> Container '{options['name']}' is already running", fg="yellow")
            return container

        click.secho(f"> Stopping container '{container.name}'", fg="yellow")
        container.stop()
        click.secho(f"> Removing container '{container.name}'", fg="yellow")
        container.remove()

    for key, value in list(options["environment"].items()):
        options["environment"][key] = value.format(containers=containers)

    click.secho(f"> Pulling image '{options['image']}'", fg="green")
    retryable_pull(client, options["image"], platform=options.get("platform"))

    for mount in list(options.get("volumes", {}).keys()):
        if "/" not in mount:
            get_or_create(client, "volume", project + "_" + mount)
            options["volumes"][project + "_" + mount] = options["volumes"].pop(mount)

    listening = ""
    if options["ports"]:
        listening = "(listening: %s)" % ", ".join(map(str, options["ports"].values()))

    click.secho(f"> Creating container '{options['name']}'", fg="yellow")
    container = client.containers.create(**options)
    click.secho(f"> Starting container '{container.name}' {listening}", fg="yellow")
    container.start()
    return container


@devservices.command()
@click.option("--project", default="sentry")
@click.argument("service", nargs=-1)
def down(project: str, service: list[str]) -> None:
    """
    Shut down services without deleting their underlying data.
    Useful if you want to temporarily relieve resources on your computer.

    The default is everything, however you may pass positional arguments to specify
    an explicit list of services to bring down.
    """

    click.secho(
        """
WARNING: We're transitioning from `sentry devservices` to the new and improved `devservices` in January 2025.
To give the new devservices a try, set the `USE_NEW_DEVSERVICES` environment variable to `1`. For a full list of commands, see
https://github.com/getsentry/devservices?tab=readme-ov-file#commands

Instead of running `sentry devservices down`, consider using `devservices down`.
For Sentry employees - if you hit any bumps or have feedback, we'd love to hear from you in #discuss-dev-infra.
Thanks for helping the Dev Infra team improve this experience!

    """,
        fg="yellow",
    )

    def _down(container: docker.models.containers.Container) -> None:
        click.secho(f"> Stopping '{container.name}' container", fg="red")
        container.stop()
        click.secho(f"> Removing '{container.name}' container", fg="red")
        container.remove()

    containers = []
    prefix = f"{project}_"

    with get_docker_client() as docker_client:
        for container in docker_client.containers.list(all=True):
            if not container.name.startswith(prefix):
                continue
            if service and not container.name[len(prefix) :] in service:
                continue
            containers.append(container)

        with ThreadPoolExecutor(max_workers=len(containers) or 1) as executor:
            futures = []
            for container in containers:
                futures.append(executor.submit(_down, container))
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    click.secho(f"> Failed to stop service: {e}", err=True, fg="red")
                    raise


@devservices.command()
@click.option("--project", default="sentry")
@click.argument("services", nargs=-1)
def rm(project: str, services: list[str]) -> None:
    """
    Shut down and delete all services and associated data.
    Useful if you'd like to start with a fresh slate.

    The default is everything, however you may pass positional arguments to specify
    an explicit list of services to remove.
    """
    from docker.errors import NotFound

    from sentry.runner import configure

    configure()

    containers = _prepare_containers(project, skip_only_if=len(services) > 0, silent=True)

    if services:
        selected_containers = {}
        for service in services:
            # XXX: This code is also fairly duplicated in here at this point, so dedupe in the future.
            if service not in containers:
                click.secho(
                    f"Service `{service}` is not known or not enabled.\n",
                    err=True,
                    fg="red",
                )
                click.secho(
                    "Services that are available:\n" + "\n".join(containers.keys()) + "\n", err=True
                )
                raise click.Abort()
            selected_containers[service] = containers[service]
        containers = selected_containers

    click.confirm(
        """
This will delete these services and all of their data:

%s

Are you sure you want to continue?"""
        % "\n".join(containers.keys()),
        abort=True,
    )

    with get_docker_client() as docker_client:
        volume_to_service = {}
        for service_name, container_options in containers.items():
            try:
                container = docker_client.containers.get(container_options["name"])
            except NotFound:
                click.secho(
                    "> WARNING: non-existent container '%s'" % container_options["name"],
                    err=True,
                    fg="yellow",
                )
                continue

            click.secho("> Stopping '%s' container" % container_options["name"], err=True, fg="red")
            container.stop()
            click.secho("> Removing '%s' container" % container_options["name"], err=True, fg="red")
            container.remove()
            for volume in container_options.get("volumes") or ():
                volume_to_service[volume] = service_name

        prefix = project + "_"

        for volume in docker_client.volumes.list():
            if volume.name.startswith(prefix):
                local_name = volume.name[len(prefix) :]
                if not services or volume_to_service.get(local_name) in services:
                    click.secho("> Removing '%s' volume" % volume.name, err=True, fg="red")
                    volume.remove()

        if not services:
            try:
                network = docker_client.networks.get(project)
            except NotFound:
                pass
            else:
                click.secho("> Removing '%s' network" % network.name, err=True, fg="red")
                network.remove()


def check_health(service_name: str, options: dict[str, Any]) -> None:
    healthcheck = service_healthchecks.get(service_name, None)
    if healthcheck is None:
        return

    click.secho(f"> Checking container health '{service_name}'", fg="yellow")

    def hc() -> None:
        healthcheck.check(options)

    try:
        run_with_retries(
            hc,
            healthcheck.retries,
            healthcheck.timeout,
            f"Health check for '{service_name}' failed",
        )
        click.secho(f"  > '{service_name}' is healthy", fg="green")
    except subprocess.CalledProcessError:
        click.secho(f"  > '{service_name}' is not healthy", fg="red")
        raise


def run_with_retries(
    cmd: Callable[[], object], retries: int = 3, timeout: int = 5, message: str = "Command failed"
) -> None:
    for retry in range(1, retries + 1):
        try:
            cmd()
        except (
            subprocess.CalledProcessError,
            urllib.error.HTTPError,
            http.client.RemoteDisconnected,
        ):
            if retry == retries:
                raise
            else:
                click.secho(
                    f"  > {message}, retrying in {timeout}s (attempt {retry+1} of {retries})...",
                    fg="yellow",
                )
                time.sleep(timeout)
        else:
            return


def check_postgres(options: dict[str, Any]) -> None:
    subprocess.run(
        (
            "docker",
            "exec",
            options["name"],
            "pg_isready",
            "-U",
            "postgres",
        ),
        check=True,
        capture_output=True,
        text=True,
    )


def check_rabbitmq(options: dict[str, Any]) -> None:
    subprocess.run(
        (
            "docker",
            "exec",
            options["name"],
            "rabbitmq-diagnostics",
            "-q",
            "ping",
        ),
        check=True,
        capture_output=True,
        text=True,
    )


def check_redis(options: dict[str, Any]) -> None:
    subprocess.run(
        (
            "docker",
            "exec",
            options["name"],
            "redis-cli",
            "ping",
        ),
        check=True,
        capture_output=True,
        text=True,
    )


def check_vroom(options: dict[str, Any]) -> None:
    (port,) = options["ports"].values()

    # Vroom is a slim debian based image and does not have curl, wget or
    # python3. Check health with a simple request on the host machine.
    urllib.request.urlopen(f"http://{port[0]}:{port[1]}/health", timeout=1)


def check_clickhouse(options: dict[str, Any]) -> None:
    port = options["ports"]["8123/tcp"]
    subprocess.run(
        (
            "docker",
            "exec",
            options["name"],
            # Using wget instead of curl as that is what is available
            # in the clickhouse image
            "wget",
            f"http://{port[0]}:{port[1]}/ping",
        ),
        check=True,
        capture_output=True,
        text=True,
    )


def check_kafka(options: dict[str, Any]) -> None:
    (port,) = options["ports"].values()
    subprocess.run(
        (
            "docker",
            "exec",
            options["name"],
            "kafka-topics",
            "--bootstrap-server",
            # Port is a tuple of (127.0.0.1, <port number>)
            f"{port[0]}:{port[1]}",
            "--list",
        ),
        check=True,
        capture_output=True,
        text=True,
    )


def check_symbolicator(options: dict[str, Any]) -> None:
    (port,) = options["ports"].values()
    subprocess.run(
        (
            "docker",
            "exec",
            options["name"],
            "curl",
            f"http://{port[0]}:{port[1]}/healthcheck",
        ),
        check=True,
        capture_output=True,
        text=True,
    )


def python_call_url_prog(url: str) -> str:
    return f"""
import urllib.request
try:
    req = urllib.request.urlopen({url!r}, timeout=1)
except Exception as e:
    raise SystemExit(f'service is not ready: {{e}}')
else:
    print('service is ready!')
"""


def check_chartcuterie(options: dict[str, Any]) -> None:
    # Chartcuterie binds the internal port to a different port
    internal_port = 9090
    port = options["ports"][f"{internal_port}/tcp"]
    url = f"http://{port[0]}:{internal_port}/api/chartcuterie/healthcheck/live"
    subprocess.run(
        (
            "docker",
            "exec",
            options["name"],
            "python3",
            "-uc",
            python_call_url_prog(url),
        ),
        check=True,
        capture_output=True,
        text=True,
    )


def check_snuba(options: dict[str, Any]) -> None:
    from django.conf import settings

    url = f"{settings.SENTRY_SNUBA}/health_envoy"
    subprocess.run(
        (
            "docker",
            "exec",
            options["name"],
            "python3",
            "-uc",
            python_call_url_prog(url),
        ),
        check=True,
        capture_output=True,
        text=True,
    )


class ServiceHealthcheck(NamedTuple):
    check: Callable[[dict[str, Any]], None]
    retries: int = 3
    timeout: int = 5


service_healthchecks: dict[str, ServiceHealthcheck] = {
    "postgres": ServiceHealthcheck(check=check_postgres),
    "rabbitmq": ServiceHealthcheck(check=check_rabbitmq),
    "redis": ServiceHealthcheck(check=check_redis),
    "clickhouse": ServiceHealthcheck(check=check_clickhouse),
    "kafka": ServiceHealthcheck(check=check_kafka),
    "vroom": ServiceHealthcheck(check=check_vroom),
    "symbolicator": ServiceHealthcheck(check=check_symbolicator),
    "chartcuterie": ServiceHealthcheck(check=check_chartcuterie),
    "snuba": ServiceHealthcheck(check=check_snuba, retries=12, timeout=10),
}
