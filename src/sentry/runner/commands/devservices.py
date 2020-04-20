from __future__ import absolute_import, print_function

import atexit
import signal
import os
import click
from six import text_type
from itertools import chain
from sentry.utils.compat import map


def get_docker_client():
    import docker

    client = docker.from_env()
    try:
        client.ping()
        return client
    except Exception:
        raise click.ClickException("Make sure Docker is running.")


def get_or_create(client, thing, name):
    import docker

    try:
        return getattr(client, thing + "s").get(name)
    except docker.errors.NotFound:
        click.secho("> Creating '%s' %s" % (name, thing), err=True, fg="yellow")
        return getattr(client, thing + "s").create(name)


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
def devservices():
    """
    Manage dependent development services required for Sentry.

    Do not use in production!
    """


@devservices.command()
@click.option("--project", default="sentry")
@click.argument("service", nargs=1)
def attach(project, service):
    """
    Run a single devservice in foreground, as opposed to `up` which runs all of
    them in the background.

    Accepts a single argument, the name of the service to spawn. The service
    will run with output printed to your terminal, and the ability to kill it
    with ^C. This is used in devserver.

    Note: This does not update images, you will have to use `devservices up`
    for that.
    """

    os.environ["SENTRY_SKIP_BACKEND_VALIDATION"] = "1"

    from sentry.runner import configure

    configure()

    client = get_docker_client()
    containers = _prepare_containers(project)
    container = _start_service(client, service, containers, project, fast=True)

    def exit_handler(*_):
        click.echo("Shutting down {}".format(service))
        try:
            container.stop()
        except KeyboardInterrupt:
            pass

    atexit.register(exit_handler)
    signal.signal(signal.SIGINT, exit_handler)
    signal.signal(signal.SIGTERM, exit_handler)

    for line in container.logs(stream=True):
        click.echo(line, nl=False)


@devservices.command()
@click.option("--project", default="sentry")
@click.option("--exclude", multiple=True, help="Services to ignore and not run.")
@click.argument("service", nargs=1, required=False)
def up(project, service, exclude):
    """
    Run/update dependent services.

    This optionally accepts a single argument, the name of a single service to
    spawn, as opposed to all of them. In that mode the service will run with
    output printed to your terminal, and the ability to kill it with ^C. This
    is used in devservices as well.

    Note: To read logs of running services `docker logs -f sentry_snuba` is
    sufficient.
    """

    os.environ["SENTRY_SKIP_BACKEND_VALIDATION"] = "1"

    exclude = set(chain.from_iterable(x.split(",") for x in exclude))

    from sentry.runner import configure

    configure()

    from django.conf import settings

    client = get_docker_client()

    get_or_create(client, "network", project)
    pulled = set()

    containers = _prepare_containers(project)

    for name, options in settings.SENTRY_DEVSERVICES.items():
        if name in exclude:
            continue

        if name not in containers:
            continue

        _start_service(client, name, containers, project, pulled=pulled)


def _prepare_containers(project):
    from django.conf import settings
    from sentry import options as sentry_options

    containers = {}

    for name, options in settings.SENTRY_DEVSERVICES.items():
        options = options.copy()
        test_fn = options.pop("only_if", None)
        if test_fn and not test_fn(settings, sentry_options):
            click.secho("! Skipping {} due to only_if condition".format(name), err=True, fg="cyan")
            continue

        options["network"] = project
        options["detach"] = True
        options["name"] = project + "_" + name
        options.setdefault("ports", {})
        options.setdefault("environment", {})
        options.setdefault("restart_policy", {"Name": "on-failure"})
        options["ports"] = ensure_interface(options["ports"])
        containers[name] = options

    return containers


def _start_service(client, name, containers, project, pulled=None, fast=False):
    import docker

    from django.conf import settings

    options = containers[name]
    options.pop("with_devserver", False)

    # HACK(mattrobenolt): special handle snuba backend because it needs to
    # handle different values based on the eventstream backend
    # For snuba, we can't run the full suite of devserver, but can only
    # run the api.
    if name == "snuba" and "snuba" in settings.SENTRY_EVENTSTREAM:
        options["environment"].pop("DEFAULT_BROKERS", None)
        options["command"] = ["devserver", "--no-workers"]

    for key, value in options["environment"].items():
        options["environment"][key] = value.format(containers=containers)

    pull = options.pop("pull", False)
    if not fast and pull and (pulled is None or options["image"] not in pulled):
        click.secho("> Pulling image '%s'" % options["image"], err=True, fg="green")
        client.images.pull(options["image"])
        if pulled is not None:
            pulled.add(options["image"])
    for mount in options.get("volumes", {}).keys():
        if "/" not in mount:
            get_or_create(client, "volume", project + "_" + mount)
            options["volumes"][project + "_" + mount] = options["volumes"].pop(mount)

    listening = ""
    if options["ports"]:
        listening = " (listening: %s)" % ", ".join(map(text_type, options["ports"].values()))

    try:
        container = client.containers.get(options["name"])
    except docker.errors.NotFound:
        pass
    else:
        if fast:
            click.secho(
                "> Starting existing '%s' container%s" % (options["name"], listening),
                err=True,
                fg="yellow",
            )
            container.start()
            return container

        container.stop()
        container.remove()

    click.secho("> Creating '%s' container%s" % (options["name"], listening), err=True, fg="yellow")
    return client.containers.run(**options)


@devservices.command()
@click.option("--project", default="sentry")
@click.argument("service", nargs=-1)
def down(project, service):
    "Shut down all services."
    client = get_docker_client()

    prefix = project + "_"

    for container in client.containers.list(all=True):
        if container.name.startswith(prefix):
            if not service or container.name[len(prefix) :] in service:
                click.secho("> Removing '%s' container" % container.name, err=True, fg="red")
                container.stop()
                container.remove()


@devservices.command()
@click.option("--project", default="sentry")
@click.argument("service", nargs=-1)
def rm(project, service):
    "Delete all services and associated data."

    click.confirm(
        "Are you sure you want to continue?\nThis will delete all of your Sentry related data!",
        abort=True,
    )

    import docker

    client = get_docker_client()

    prefix = project + "_"

    for container in client.containers.list(all=True):
        if container.name.startswith(prefix):
            if not service or container.name[len(prefix) :] in service:
                click.secho("> Removing '%s' container" % container.name, err=True, fg="red")
                container.stop()
                container.remove()

    for volume in client.volumes.list():
        if volume.name.startswith(prefix):
            if not service or volume.name[len(prefix) :] in service:
                click.secho("> Removing '%s' volume" % volume.name, err=True, fg="red")
                volume.remove()

    if not service:
        try:
            network = client.networks.get(project)
        except docker.errors.NotFound:
            pass
        else:
            click.secho("> Removing '%s' network" % network.name, err=True, fg="red")
            network.remove()
