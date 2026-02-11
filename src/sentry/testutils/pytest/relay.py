# Fixtures used to interact with a test Relay server


import datetime
import logging
import shutil
import time
from os import environ, path
from urllib.parse import urlparse

import ephemeral_port_reserve
import pytest
import requests

from sentry.runner.commands.devservices import get_docker_client
from sentry.testutils.pytest.sentry import _get_xdist_kafka_topic, _get_xdist_redis_db

_log = logging.getLogger(__name__)


# This helps the Relay CI to specify the generated Docker build before it is published
RELAY_TEST_IMAGE = environ.get("RELAY_TEST_IMAGE", "ghcr.io/getsentry/relay:nightly")

# Relay credentials (must match template/credentials.json)
_RELAY_ID = "88888888-4444-4444-8444-cccccccccccc"
_RELAY_PUBLIC_KEY = "SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8"


def _relay_server_container_name() -> str:
    """Under xdist, each worker gets its own container to avoid name conflicts."""
    worker_id = environ.get("PYTEST_XDIST_WORKER")
    if worker_id:
        return f"sentry_test_relay_server_{worker_id}"
    return "sentry_test_relay_server"


def _get_template_dir():
    return path.abspath(path.join(path.dirname(__file__), "template"))


def _remove_container_if_exists(docker_client, container_name):
    try:
        container = docker_client.containers.get(container_name)
    except Exception:
        pass  # container not found
    else:
        actions = [
            lambda: container.stop(timeout=1),
            lambda: container.kill(),
            lambda: container.remove(),
        ]
        for action in actions:
            try:
                action()
            except Exception:
                pass


def _ensure_relay_in_db():
    """Ensure the Relay model exists in the DB.

    TransactionTestCase flushes the entire DB between tests, which deletes
    the Relay model that was created when the container first registered.
    Without this row, Sentry returns 401 on /api/0/relays/projectconfigs/
    because it can't look up the relay by relay_id.

    This is the key fix that enables class-scoped containers — we re-insert
    the Relay identity before each test instead of restarting the container.
    """
    from sentry.models.relay import Relay

    Relay.objects.get_or_create(
        relay_id=_RELAY_ID,
        defaults={
            "public_key": _RELAY_PUBLIC_KEY,
            "is_internal": True,
        },
    )


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

    # Use a worker-specific port hint to avoid collisions under xdist.
    # Each worker offsets by 100 so their ephemeral_port_reserve searches
    # don't overlap (gw0→33331, gw1→33431, gw2→33531, etc.)
    worker_id = environ.get("PYTEST_XDIST_WORKER", "gw0")
    worker_num = int(worker_id.replace("gw", ""))
    relay_port = ephemeral_port_reserve.reserve(ip="127.0.0.1", port=33331 + worker_num * 100)

    redis_db = _get_xdist_redis_db()

    from sentry.relay import projectconfig_cache
    from sentry.relay.projectconfig_cache.redis import RedisProjectConfigCache

    projectconfig_backend = projectconfig_cache.backend.test_only__downcast_to(
        RedisProjectConfigCache
    )
    assert redis_db == projectconfig_backend.cluster.connection_pool.connection_kwargs["db"]

    template_vars = {
        "SENTRY_HOST": f"http://host.docker.internal:{port}/",
        "RELAY_PORT": relay_port,
        "KAFKA_HOST": "kafka",
        "REDIS_HOST": "redis",
        "REDIS_DB": redis_db,
        "KAFKA_TOPIC_EVENTS": _get_xdist_kafka_topic("ingest-events"),
        "KAFKA_TOPIC_OUTCOMES": _get_xdist_kafka_topic("outcomes"),
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
        "network": "devservices",
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


@pytest.fixture(scope="class")
def _relay_container(relay_server_setup):
    """Class-scoped: start Docker container once per test class.

    Instead of restarting the container for every test (10s overhead each),
    we keep it running for the entire class. The per-test relay_server fixture
    handles re-inserting the Relay model into the DB (which TransactionTestCase
    flushes between tests).
    """
    options = relay_server_setup["options"]
    container_name = _relay_server_container_name()

    with get_docker_client() as docker_client:
        _remove_container_if_exists(docker_client, container_name)
        container = docker_client.containers.run(**options)

    _log.info("Waiting for Relay container to start (class-scoped)")

    url = relay_server_setup["url"]
    for i in range(10):
        try:
            requests.get(url)
            break
        except Exception as ex:
            if i == 9:
                _log.exception(str(ex))
                raise ValueError(
                    f"relay did not start in time (now: {datetime.datetime.now().isoformat()}) "
                    f"{url}:\n{container.logs().decode()}"
                ) from ex
            time.sleep(0.1 * 2**i)

    yield {"url": url}

    # Cleanup at end of class
    with get_docker_client() as docker_client:
        _remove_container_if_exists(docker_client, container_name)


@pytest.fixture(scope="function")
def relay_server(_relay_container, settings):
    """Function-scoped: adjust settings and ensure Relay identity in DB.

    The Docker container persists across tests (class-scoped via _relay_container).
    This fixture just handles per-test setup:
    1. Adjust Django settings for relay
    2. Re-insert the Relay model (flushed by TransactionTestCase between tests)
    """
    adjust_settings_for_relay_tests(settings)
    _ensure_relay_in_db()
    yield {"url": _relay_container["url"]}


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
