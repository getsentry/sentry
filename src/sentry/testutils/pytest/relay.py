# Fixtures used to interact with a test Relay server


import datetime
import logging
import shutil
import time
from os import environ, path
from urllib.parse import urlparse

import pytest
import requests

from sentry.runner.commands.devservices import get_docker_client
from sentry.testutils.pytest.sentry import TEST_REDIS_DB

_log = logging.getLogger(__name__)


# This helps the Relay CI to specify the generated Docker build before it is published
RELAY_TEST_IMAGE = environ.get(
    "RELAY_TEST_IMAGE", "us-central1-docker.pkg.dev/sentryio/relay/relay:nightly"
)


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


@pytest.fixture(scope="module")
def relay_server_setup(live_server, tmpdir_factory):
    prefix = "test_relay_config_{}_".format(
        datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S_%f")
    )
    config_path = tmpdir_factory.mktemp(prefix)
    config_path.chmod(0o755)
    config_path = str(config_path)

    parsed_live_server_url = urlparse(live_server.url)
    if parsed_live_server_url.port is not None:
        port = parsed_live_server_url.port
    else:
        port = 80

    template_path = _get_template_dir()
    sources = ["config.yml", "credentials.json"]

    # NOTE: if we ever need to start the test relay server at various ports here's where we need to change
    relay_port = 33331

    redis_db = TEST_REDIS_DB
    use_old_devservices = environ.get("USE_OLD_DEVSERVICES", "0") == "1"
    from sentry.relay import projectconfig_cache
    from sentry.relay.projectconfig_cache.redis import RedisProjectConfigCache

    projectconfig_backend = projectconfig_cache.backend.test_only__downcast_to(
        RedisProjectConfigCache
    )
    assert redis_db == projectconfig_backend.cluster.connection_pool.connection_kwargs["db"]

    template_vars = {
        "SENTRY_HOST": f"http://host.docker.internal:{port}/",
        "RELAY_PORT": relay_port,
        "KAFKA_HOST": "sentry_kafka" if use_old_devservices else "kafka-kafka-1",
        "REDIS_HOST": "sentry_redis" if use_old_devservices else "redis-redis-1",
        "REDIS_DB": redis_db,
    }

    for source in sources:
        source_path = path.join(template_path, source)
        dest_path = path.join(config_path, source)
        with open(source_path) as input:
            content = input.read()

        for var_name, var_val in template_vars.items():
            content = content.replace("${%s}" % var_name, str(var_val))

        with open(dest_path, "w") as output:
            output.write(content)

    # we have a config path for relay that is set up with the current live serve as upstream
    # check if we have the test relay docker container
    with get_docker_client() as docker_client:
        container_name = _relay_server_container_name()
        _remove_container_if_exists(docker_client, container_name)

    options = {
        "image": RELAY_TEST_IMAGE,
        "ports": {"%s/tcp" % relay_port: relay_port},
        "network": "sentry" if use_old_devservices else "devservices",
        "detach": True,
        "name": container_name,
        "volumes": {config_path: {"bind": "/etc/relay"}},
        "command": ["run", "--config", "/etc/relay"],
        "extra_hosts": {"host.docker.internal": "host-gateway"},
    }

    # Some structure similar to what the live_server fixture returns
    server_info = {"url": f"http://127.0.0.1:{relay_port}", "options": options}

    yield server_info

    # cleanup
    shutil.rmtree(config_path)
    if not environ.get("RELAY_TEST_KEEP_CONTAINER", False):
        with get_docker_client() as docker_client:
            _remove_container_if_exists(docker_client, container_name)


@pytest.fixture(scope="function")
def relay_server(relay_server_setup, settings):
    adjust_settings_for_relay_tests(settings)
    options = relay_server_setup["options"]
    with get_docker_client() as docker_client:
        container_name = _relay_server_container_name()
        _remove_container_if_exists(docker_client, container_name)
        container = docker_client.containers.run(**options)

    _log.info("Waiting for Relay container to start")

    url = relay_server_setup["url"]

    for i in range(8):
        try:
            requests.get(url)
            break
        except Exception as ex:
            if i == 7:
                _log.exception(str(ex))
                raise ValueError(
                    f"relay did not start in time {url}:\n{container.logs().decode()}"
                ) from ex
            time.sleep(0.1 * 2**i)
    else:
        raise ValueError("relay did not start in time")

    return {"url": relay_server_setup["url"]}


def adjust_settings_for_relay_tests(settings):
    """
    Adjusts the application settings to accept calls from a Relay instance running inside a
    docker container.

    :param settings: the app settings
    """
    settings.ALLOWED_HOSTS = [
        "localhost",
        "testserver",
        "host.docker.internal",
        "0.0.0.0",
        "127.0.0.1",
    ]
    settings.KAFKA_CLUSTERS = {
        "default": {
            "common": {"bootstrap.servers": "127.0.0.1:9092"},
            "producers": {
                "compression.type": "lz4",
                "message.max.bytes": 50000000,  # 50MB, default is 1MB
            },
        }
    }
    settings.SENTRY_RELAY_WHITELIST_PK = ["SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8"]
    settings.SENTRY_USE_RELAY = True


@pytest.fixture
def get_relay_store_url(relay_server):
    def inner(project_id):
        return "{}/api/{}/store/".format(relay_server["url"], project_id)

    return inner


@pytest.fixture
def get_relay_security_url(relay_server):
    def inner(project_id, key):
        return "{}/api/{}/security/?sentry_key={}".format(relay_server["url"], project_id, key)

    return inner


@pytest.fixture
def get_relay_minidump_url(relay_server):
    def inner(project_id, key):
        return "{}/api/{}/minidump/?sentry_key={}".format(relay_server["url"], project_id, key)

    return inner


@pytest.fixture
def get_relay_unreal_url(relay_server):
    def inner(project_id, key):
        return "{}/api/{}/unreal/{}/".format(relay_server["url"], project_id, key)

    return inner


@pytest.fixture
def get_relay_attachments_url(relay_server):
    def inner(project_id, event_id):
        return "{}/api/{}/events/{}/attachments/".format(relay_server["url"], project_id, event_id)

    return inner
