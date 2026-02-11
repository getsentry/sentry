# Fixtures used to interact with a test Relay server


import datetime
import logging
import shutil
import signal
import subprocess
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

# Path to a native Relay binary (extracted from Docker image in CI).
# When set, uses subprocess instead of Docker for ~10x faster startup.
RELAY_NATIVE_BIN = environ.get("RELAY_NATIVE_BIN")


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

    relay_port = ephemeral_port_reserve.reserve(ip="127.0.0.1", port=33331)

    redis_db = _get_xdist_redis_db()

    from sentry.relay import projectconfig_cache
    from sentry.relay.projectconfig_cache.redis import RedisProjectConfigCache

    projectconfig_backend = projectconfig_cache.backend.test_only__downcast_to(
        RedisProjectConfigCache
    )
    assert redis_db == projectconfig_backend.cluster.connection_pool.connection_kwargs["db"]

    # Native binary runs on the host — use 127.0.0.1 for all services.
    # Docker container runs on the devservices network — use Docker hostnames.
    native_mode = bool(RELAY_NATIVE_BIN)
    if native_mode:
        sentry_host = f"http://127.0.0.1:{port}/"
        kafka_host = "127.0.0.1"
        kafka_port = "9092"
        redis_host = "127.0.0.1"
    else:
        sentry_host = f"http://host.docker.internal:{port}/"
        kafka_host = "kafka"
        kafka_port = "9093"
        redis_host = "redis"

    template_vars = {
        "SENTRY_HOST": sentry_host,
        "RELAY_PORT": relay_port,
        "KAFKA_HOST": kafka_host,
        "KAFKA_PORT": kafka_port,
        "REDIS_HOST": redis_host,
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

    if native_mode:
        server_info = {
            "url": f"http://127.0.0.1:{relay_port}",
            "config_path": config_path,
            "mode": "native",
        }
    else:
        # Docker mode: clean up any existing container and prepare options
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

        server_info = {
            "url": f"http://127.0.0.1:{relay_port}",
            "options": options,
            "mode": "docker",
        }

    yield server_info

    # cleanup
    shutil.rmtree(config_path)
    if server_info["mode"] == "docker" and not environ.get("RELAY_TEST_KEEP_CONTAINER", False):
        with get_docker_client() as docker_client:
            _remove_container_if_exists(docker_client, _relay_server_container_name())


def _start_native_relay(config_path, url):
    """Start Relay as a native subprocess. Returns (process, url)."""
    proc = subprocess.Popen(
        [RELAY_NATIVE_BIN, "run", "--config", config_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Check for immediate crash
    time.sleep(0.2)
    if proc.poll() is not None:
        stdout = proc.stdout.read().decode() if proc.stdout else ""
        stderr = proc.stderr.read().decode() if proc.stderr else ""
        raise ValueError(
            f"relay native binary exited immediately with code {proc.returncode}.\n"
            f"STDERR: {stderr}\nSTDOUT: {stdout}"
        )

    # Wait for health
    for i in range(10):
        try:
            requests.get(url, timeout=1)
            return proc
        except Exception:
            if i == 9:
                proc.kill()
                stdout = proc.stdout.read().decode() if proc.stdout else ""
                stderr = proc.stderr.read().decode() if proc.stderr else ""
                raise ValueError(
                    f"relay native binary did not become healthy at {url}.\n"
                    f"STDERR: {stderr}\nSTDOUT: {stdout}"
                )
            time.sleep(0.3 * (i + 1))

    raise ValueError("relay did not start in time")


def _stop_native_relay(proc):
    """Gracefully stop a native Relay subprocess."""
    if proc.poll() is not None:
        return
    try:
        proc.send_signal(signal.SIGTERM)
        proc.wait(timeout=3)
    except Exception:
        proc.kill()
        proc.wait(timeout=2)


@pytest.fixture(scope="function")
def relay_server(relay_server_setup, settings):
    adjust_settings_for_relay_tests(settings)
    url = relay_server_setup["url"]

    if relay_server_setup["mode"] == "native":
        # Native binary: start subprocess per test (~0.5s vs ~10s for Docker)
        proc = _start_native_relay(relay_server_setup["config_path"], url)
        yield {"url": url}
        _stop_native_relay(proc)
    else:
        # Docker mode: start container per test (original behavior)
        options = relay_server_setup["options"]
        with get_docker_client() as docker_client:
            container_name = _relay_server_container_name()
            _remove_container_if_exists(docker_client, container_name)
            container = docker_client.containers.run(**options)

        _log.info("Waiting for Relay container to start")

        for i in range(8):
            try:
                requests.get(url)
                break
            except Exception as ex:
                if i == 7:
                    _log.exception(str(ex))
                    raise ValueError(
                        f"relay did not start in time (now: {datetime.datetime.now().isoformat()}) "
                        f"{url}:\n{container.logs().decode()}"
                    ) from ex
                time.sleep(0.1 * 2**i)
        else:
            raise ValueError("relay did not start in time")

        yield {"url": url}


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
