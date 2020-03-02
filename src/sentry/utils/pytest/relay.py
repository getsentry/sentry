# Fixutres used to interact with a test Relay server

from __future__ import absolute_import
import pytest
from os import path
import six
from six.moves.urllib.parse import urlparse
import sys
import datetime
import shutil

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
        try:
            container.kill()
        except Exception:
            pass  # maybe the container is already stopped
        try:
            container.remove()
        except Exception:
            pass  # could not remove the container nothing to do about it


@pytest.fixture(scope="session")
def relay_server_setup(live_server, tmpdir_factory):
    prefix = "test_relay_config_{}_".format(
        datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S_%f")
    )
    config_path = tmpdir_factory.mktemp(prefix)
    config_path = six.text_type(config_path)

    upstream_url = urlparse(live_server.url)
    if upstream_url.port is not None:
        port = six.text_type(upstream_url.port)
    else:
        port = "80"

    if sys.platform.startswith("linux"):
        upstream = "http://127.0.0.1:%s/" % port
    else:
        upstream = "http://host.docker.internal:%s/" % port

    template_path = _get_template_dir()
    sources = ["config.yml", "credentials.json"]
    env_vars = [("SENTRY_HOST", upstream)]

    for source in sources:
        source_path = path.join(template_path, source)
        dest_path = path.join(config_path, source)
        with open(source_path, "rt") as input:
            content = input.read()

        for var_name, var_val in env_vars:
            content = content.replace("${%s}" % var_name, var_val)

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

    # Some structure similar to what the live_server fixture returns
    server_info = {
        "url": "http://127.0.0.1:{}".format(_relay_port),
        "is_started": False,
        "options": options,
    }

    yield server_info

    # cleanup
    shutil.rmtree(config_path)
    _remove_container_if_exists(docker_client, container_name)


@pytest.fixture(scope="function")
def relay_server(relay_server_setup):
    options = relay_server_setup["options"]
    docker_client = get_docker_client()
    container_name = _relay_server_container_name()
    _remove_container_if_exists(docker_client, container_name)
    docker_client.containers.run(**options)
    relay_server_setup["is_started"] = True
    return {"url": relay_server_setup["url"]}


@pytest.fixture
def get_relay_store_url(relay_server):
    def relay_store_url(project_id):
        return "{}/api/{}/store/".format(relay_server["url"], project_id)

    return relay_store_url


@pytest.fixture(scope="function")
def persistent_relay_server(relay_server_setup):
    options = relay_server_setup["options"]

    if not relay_server_setup["is_started"]:
        # first time we use it in a test, everything should be
        # already setup, sentry should be running and configured,
        # just run relay
        docker_client = get_docker_client()
        docker_client.containers.run(**options)
        relay_server_setup["is_started"] = True

    return {"url": relay_server_setup["url"]}
