# Fixutres used to interact with a test Relay server

from __future__ import absolute_import
import pytest
from os import path, makedirs

from six.moves.urllib.parse import urlparse
import shutil
import datetime

from sentry.runner.commands.devservices import get_docker_client


def _relay_server_container_name():
    return "sentry_test_relay_server"


def _get_template_dir():
    return path.abspath(path.join(path.dirname(__file__), "template"))


def _remove_container_if_exists(docker_client, container_name):
    try:
        container = docker_client.containers.get(container_name)
    except Exception:
        pass  # container not found
    else:
        container.stop()
        container.remove()


@pytest.fixture(scope="session")
def relay_server(live_server):
    now = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S_%f")
    config_path = path.expanduser("~/.tmp/test_relay_config/{}".format(now))

    if not path.exists(config_path):
        makedirs(config_path)

    template_path = _get_template_dir()

    sources = ["config.yml", "credentials.json"]

    upstream_url = urlparse(live_server.url)

    port = "{}".format(upstream_url.port) if upstream_url.port is not None else "80"

    env_vars = [("SENTRY_PORT", port)]

    for source in sources:
        source_path = path.join(template_path, source)
        dest_path = path.join(config_path, source)
        with open(source_path, "rt") as input:
            content = input.read()

        for var_name, var_val in env_vars:
            name = "${{{}}}".format(var_name)
            content = content.replace(name, var_val)

        with open(dest_path, "wt") as output:
            output.write(content)

    # we have a config path for relay that is set up with the current live serve as upstream
    # check if we have the test relay docker container
    docker_client = get_docker_client()
    container_name = _relay_server_container_name()
    _remove_container_if_exists(docker_client, container_name)
    # NOTE: if we ever need to start the test relay server at various ports here's where we need to change
    _relay_port = 3333
    options = {
        "image": "us.gcr.io/sentryio/relay:latest",
        "ports": {"3000/tcp": _relay_port},
        "network": "sentry",
        "detach": True,
        "name": container_name,
        "volumes": {config_path: {"bind": "/etc/relay"}},
        "command": ["run", "--config", "/etc/relay"],
    }
    docker_client.containers.run(**options)

    # Some structure similar to what the live_server fixture returns
    server_info = {"url": "http://localhost:{}".format(_relay_port)}

    yield server_info

    # cleanup
    shutil.rmtree(path.expanduser("~/.tmp/test_relay_config"))
    _remove_container_if_exists(docker_client, container_name)
