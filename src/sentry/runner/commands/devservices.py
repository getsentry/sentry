import os
import signal
import time

import click

from sentry.utils.compat import map

# Work around a stupid docker issue: https://github.com/docker/for-mac/issues/5025
RAW_SOCKET_HACK_PATH = os.path.expanduser(
    "~/Library/Containers/com.docker.docker/Data/docker.raw.sock"
)
if os.path.exists(RAW_SOCKET_HACK_PATH):
    os.environ["DOCKER_HOST"] = "unix://" + RAW_SOCKET_HACK_PATH


def get_docker_client():
    import docker

    client = docker.from_env()
    try:
        client.ping()
        return client
    except Exception:
        raise click.ClickException("Make sure Docker is running.")


def get_docker_low_level_client():
    import docker

    client = docker.APIClient()
    try:
        client.ping()
        return client
    except Exception:
        raise click.ClickException("Make sure Docker is running.")


def get_or_create(client, thing, name):
    from docker.errors import NotFound

    try:
        return getattr(client, thing + "s").get(name)
    except NotFound:
        click.secho(f"> Creating '{name}' {thing}", err=True, fg="yellow")
        return getattr(client, thing + "s").create(name)


def wait_for_healthcheck(low_level_client, container_name, healthcheck_options):
    # healthcheck_options should be the dictionary for docker-py.

    # Convert ns -> s, float in both py2 + 3.
    healthcheck_timeout = healthcheck_options["timeout"] / 1000.0 ** 3
    healthcheck_interval = healthcheck_options["interval"] / 1000.0 ** 3
    healthcheck_retries = healthcheck_options["retries"]

    # This is the maximum elapsed timeout.
    timeout = healthcheck_retries * (healthcheck_interval + healthcheck_timeout)

    # And as for delay, polling is sort of cheap so we can do it quite often.
    # Important to note that the interval also defines the initial delay,
    # so the first polls will likely fail.
    delay = 0.25

    health_status = None
    start_time = time.time()

    while time.time() - start_time < timeout:
        resp = low_level_client.inspect_container(container_name)
        health_status = resp["State"]["Health"]["Status"]
        if health_status == "healthy":
            return
        time.sleep(delay)

    raise click.ClickException(
        f"Timed out waiting for {container_name}: healthcheck status {health_status}"
    )


def ensure_interface(ports):
    # If there is no interface specified, make sure the
    # default interface is 127.0.0.1
    rv = {}
    for k, v in ports.items():
        if not isinstance(v, tuple):
            v = ("127.0.0.1", v)
        rv[k] = v
    return rv


@click.group()
@click.pass_context
def devservices(ctx):
    """
    Manage dependent development services required for Sentry.

    Do not use in production!
    """
    ctx.obj["client"] = get_docker_client()
    ctx.obj["low_level_client"] = get_docker_low_level_client()

    # Disable backend validation so no devservices commands depend on like,
    # redis to be already running.
    os.environ["SENTRY_SKIP_BACKEND_VALIDATION"] = "1"


@devservices.command()
@click.option("--project", default="sentry")
@click.option("--fast", is_flag=True, default=False, help="Never pull and reuse containers.")
@click.argument("service", nargs=1)
@click.pass_context
def attach(ctx, project, fast, service):
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

    container = _start_service(
        ctx.obj["client"],
        ctx.obj["low_level_client"],
        service,
        containers,
        project,
        fast=fast,
        always_start=True,
    )

    def exit_handler(*_):
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
@click.option("--fast", is_flag=True, default=False, help="Never pull and reuse containers.")
@click.option(
    "--skip-only-if", is_flag=True, default=False, help="Skip 'only_if' checks for services"
)
@click.pass_context
def up(ctx, services, project, exclude, fast, skip_only_if):
    """
    Run/update all devservices in the background.

    The default is everything, however you may pass positional arguments to specify
    an explicit list of services to bring up.

    You may also exclude services, for example: --exclude redis --exclude postgres.
    """
    from sentry.runner import configure

    configure()

    containers = _prepare_containers(project, skip_only_if=skip_only_if, silent=True)
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

    if fast:
        click.secho(
            "> Warning! Fast mode completely eschews any image updating, so services may be stale.",
            err=True,
            fg="red",
        )

    get_or_create(ctx.obj["client"], "network", project)

    for name in selected_services:
        _start_service(
            ctx.obj["client"], ctx.obj["low_level_client"], name, containers, project, fast=fast
        )


def _prepare_containers(project, skip_only_if=False, silent=False):
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
        containers[name] = options

    # keys are service names
    # a service has 1 container exactly, the container name being value["name"]
    return containers


def _start_service(
    client, low_level_client, name, containers, project, fast=False, always_start=False
):
    from django.conf import settings

    from docker.errors import NotFound

    options = containers[name]

    # HACK(mattrobenolt): special handle snuba backend because it needs to
    # handle different values based on the eventstream backend
    # For snuba, we can't run the full suite of devserver, but can only
    # run the api.
    if name == "snuba" and "snuba" in settings.SENTRY_EVENTSTREAM:
        options["environment"].pop("DEFAULT_BROKERS", None)
        options["command"] = ["devserver", "--no-workers"]

    for key, value in list(options["environment"].items()):
        options["environment"][key] = value.format(containers=containers)

    pull = options.pop("pull", False)
    if not fast:
        if pull:
            click.secho("> Pulling image '%s'" % options["image"], err=True, fg="green")
            client.images.pull(options["image"])
        else:
            # We want make sure to pull everything on the first time,
            # (the image doesn't exist), regardless of pull=True.
            try:
                client.images.get(options["image"])
            except NotFound:
                click.secho("> Pulling image '%s'" % options["image"], err=True, fg="green")
                client.images.pull(options["image"])

    for mount in list(options.get("volumes", {}).keys()):
        if "/" not in mount:
            get_or_create(client, "volume", project + "_" + mount)
            options["volumes"][project + "_" + mount] = options["volumes"].pop(mount)

    listening = ""
    if options["ports"]:
        listening = "(listening: %s)" % ", ".join(map(str, options["ports"].values()))

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
            "> Not starting container '%s' because it should be started on-demand with devserver."
            % options["name"],
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
        # devservices which are marked with pull True will need their containers
        # to be recreated with the freshly pulled image.
        should_reuse_container = not pull

        # Except if the container is started as part of devserver we should reuse it.
        # Or, if we're in fast mode (devservices up --fast)
        if with_devserver or fast:
            should_reuse_container = True

        if should_reuse_container:
            click.secho(
                f"> Starting EXISTING container '{container.name}' {listening}",
                err=True,
                fg="yellow",
            )
            # Note that if the container is already running, this will noop.
            # This makes repeated `devservices up` quite fast.
            container.start()
            healthcheck_options = options.get("healthcheck")
            if healthcheck_options:
                wait_for_healthcheck(low_level_client, container.name, healthcheck_options)
            return container

        click.secho("> Stopping container '%s'" % container.name, err=True, fg="yellow")
        container.stop()
        click.secho("> Removing container '%s'" % container.name, err=True, fg="yellow")
        container.remove()

    click.secho("> Creating container '%s'" % options["name"], err=True, fg="yellow")
    container = client.containers.create(**options)
    click.secho(f"> Starting container '{container.name}' {listening}", err=True, fg="yellow")
    container.start()
    healthcheck_options = options.get("healthcheck")
    if healthcheck_options:
        wait_for_healthcheck(low_level_client, container.name, healthcheck_options)
    return container


@devservices.command()
@click.option("--project", default="sentry")
@click.argument("service", nargs=-1)
@click.pass_context
def down(ctx, project, service):
    """
    Shut down services without deleting their underlying containers and data.
    Useful if you want to temporarily relieve resources on your computer.

    The default is everything, however you may pass positional arguments to specify
    an explicit list of services to bring down.
    """
    prefix = project + "_"

    # TODO: make more like devservices rm

    for container in ctx.obj["client"].containers.list(all=True):
        if container.name.startswith(prefix):
            if not service or container.name[len(prefix) :] in service:
                click.secho("> Stopping '%s' container" % container.name, err=True, fg="red")
                container.stop()


@devservices.command()
@click.option("--project", default="sentry")
@click.argument("services", nargs=-1)
@click.pass_context
def rm(ctx, project, services):
    """
    Shut down and delete all services and associated data.
    Useful if you'd like to start with a fresh slate.

    The default is everything, however you may pass positional arguments to specify
    an explicit list of services to remove.
    """
    from docker.errors import NotFound
    from sentry.runner import configure

    configure()

    containers = _prepare_containers(project, silent=True)

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

    for service_name, container_options in containers.items():
        try:
            container = ctx.obj["client"].containers.get(container_options["name"])
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

    prefix = project + "_"

    for volume in ctx.obj["client"].volumes.list():
        if volume.name.startswith(prefix):
            if not services or volume.name[len(prefix) :] in services:
                click.secho("> Removing '%s' volume" % volume.name, err=True, fg="red")
                volume.remove()

    if not services:
        try:
            network = ctx.obj["client"].networks.get(project)
        except NotFound:
            pass
        else:
            click.secho("> Removing '%s' network" % network.name, err=True, fg="red")
            network.remove()
