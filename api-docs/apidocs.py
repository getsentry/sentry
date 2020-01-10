#!/usr/bin/env python2.7
from __future__ import absolute_import

import click
import docker
import os
from sentry.runner.commands.devservices import get_docker_client, get_or_create
from sentry.conf.server import SENTRY_DEVSERVICES

HERE = os.path.abspath(os.path.dirname(__file__))
OUTPUT_PATH = os.path.join(HERE, "cache")
SENTRY_CONFIG = os.environ["SENTRY_CONF"] = os.path.join(HERE, "sentry.apidocs.conf.py")
os.environ["SENTRY_SKIP_BACKEND_VALIDATION"] = "1"
# No sentry or django imports before this point

client = get_docker_client()

# Use a unique network and namespace for our apidocs
namespace = "apidocs"
network = get_or_create(client, "network", namespace)


# Define our set of containers we want to run
containers = {
    "postgres": {
        "image": SENTRY_DEVSERVICES["postgres"]["image"],
        "ports": {"5432/tcp": ("127.0.0.1", 5433)},
        "environment": {"POSTGRES_DB": "sentry_api_docs"},
    },
    "redis": {
        "image": SENTRY_DEVSERVICES["redis"]["image"],
        "ports": {"6379/tcp": ("127.0.0.1", 12355)},
        "command": ["redis-server", "--appendonly", "no"],
    },
}


# Massage our list into some shared settings instead of repeating
# it for each definition.
for name, options in containers.items():
    options["network"] = namespace
    options["detach"] = True
    options["name"] = namespace + "_" + name
    containers[name] = options

# Pull all of our unique images once.
pulled = set()
for name, options in containers.items():
    if options["image"] not in pulled:
        click.secho("> Pulling image '%s'" % options["image"], err=True, fg="green")
        client.images.pull(options["image"])
        pulled.add(options["image"])

# Run each of our containers, if found running already, delete first
# and create new. We never want to reuse.
for name, options in containers.items():
    try:
        container = client.containers.get(options["name"])
    except docker.errors.NotFound:
        pass
    else:
        container.stop()
        container.remove()

    click.secho("> Creating '%s' container" % options["name"], err=True, fg="yellow")
    client.containers.run(**options)

from sentry.runner import configure

configure()

# Fair game from here
from django.core.management import call_command

call_command("migrate", interactive=False, traceback=True, verbosity=0)


# Delete all of our containers now. If it's not running, do nothing.
for name, options in containers.items():
    try:
        container = client.containers.get(options["name"])
    except docker.errors.NotFound:
        pass
    else:
        click.secho("> Removing '%s' container" % container.name, err=True, fg="red")
        container.stop()
        container.remove()

# Remove our network that we created.
click.secho("> Removing '%s' network" % network.name, err=True, fg="red")
network.remove()
