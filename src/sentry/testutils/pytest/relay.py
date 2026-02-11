# Fixtures used to interact with a test Relay server


import datetime
import logging
import shutil
import subprocess
import time
from os import environ, path
from urllib.parse import urlparse

import ephemeral_port_reserve
import pytest
import requests

from sentry.testutils.pytest.sentry import _get_xdist_redis_db

_log = logging.getLogger(__name__)


# This helps the Relay CI to specify the generated Docker build before it is published
RELAY_TEST_IMAGE = environ.get("RELAY_TEST_IMAGE", "ghcr.io/getsentry/relay:nightly")

# Path to a native Relay binary. When set, Relay runs as a subprocess instead of Docker.
RELAY_NATIVE_BIN = environ.get("RELAY_NATIVE_BIN")


def _relay_server_container_name() -> str:
    return "sentry_test_relay_server"


def _get_template_dir():
    return path.abspath(path.join(path.dirname(__file__), "template"))


def _remove_container_if_exists(docker_client, container_name):
    if RELAY_NATIVE_BIN:
        return  # no-op in native binary mode
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

    if RELAY_NATIVE_BIN:
        # Native binary mode: Relay runs on the host, so use localhost addresses.
        # Kafka is exposed on port 9092 to the host (not 9093 which is the Docker-internal port).
        template_vars = {
            "SENTRY_HOST": f"http://127.0.0.1:{port}/",
            "RELAY_PORT": relay_port,
            "KAFKA_HOST": "127.0.0.1",
            "KAFKA_PORT": 9092,
            "REDIS_HOST": "127.0.0.1",
            "REDIS_DB": redis_db,
        }
    else:
        # Docker mode: Relay runs inside a container and uses Docker networking.
        template_vars = {
            "SENTRY_HOST": f"http://host.docker.internal:{port}/",
            "RELAY_PORT": relay_port,
            "KAFKA_HOST": "kafka",
            "KAFKA_PORT": 9093,
            "REDIS_HOST": "redis",
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

    if RELAY_NATIVE_BIN:
        # Native binary mode: no Docker client, network, or container needed.
        server_info = {
            "url": f"http://127.0.0.1:{relay_port}",
            "mode": "native",
            "binary": RELAY_NATIVE_BIN,
            "config_path": config_path,
        }
    else:
        # Docker mode: set up container options.
        from sentry.runner.commands.devservices import get_docker_client

        # we have a config path for relay that is set up with the current live server as upstream
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
    if not RELAY_NATIVE_BIN and not environ.get("RELAY_TEST_KEEP_CONTAINER", False):
        from sentry.runner.commands.devservices import get_docker_client

        with get_docker_client() as docker_client:
            _remove_container_if_exists(docker_client, container_name)


@pytest.fixture(scope="function")
def relay_server(relay_server_setup, settings):
    adjust_settings_for_relay_tests(settings)
    url = relay_server_setup["url"]

    if relay_server_setup.get("mode") == "native":
        # Native binary mode: run Relay as a subprocess.
        binary = relay_server_setup["binary"]
        config_path = relay_server_setup["config_path"]
        _log.info("Starting Relay native binary: %s (config: %s)", binary, config_path)

        # Write stdout/stderr to files so we can read them on failure
        stdout_path = path.join(config_path, "relay-stdout.log")
        stderr_path = path.join(config_path, "relay-stderr.log")
        stdout_f = open(stdout_path, "w")
        stderr_f = open(stderr_path, "w")

        process = subprocess.Popen(
            [binary, "run", "--config", config_path],
            stdout=stdout_f,
            stderr=stderr_f,
        )

        try:
            for i in range(10):
                # Check if process died
                ret = process.poll()
                if ret is not None:
                    stdout_f.flush()
                    stderr_f.flush()
                    with open(stderr_path) as f:
                        stderr_output = f.read()
                    with open(stdout_path) as f:
                        stdout_output = f.read()
                    raise ValueError(
                        f"relay native binary exited immediately with code {ret}.\n"
                        f"Binary: {binary}\nConfig: {config_path}\n"
                        f"STDERR:\n{stderr_output}\nSTDOUT:\n{stdout_output}"
                    )
                try:
                    requests.get(url)
                    break
                except Exception as ex:
                    if i == 9:
                        stdout_f.flush()
                        stderr_f.flush()
                        with open(stderr_path) as f:
                            stderr_output = f.read()
                        raise ValueError(
                            f"relay native binary did not start in time "
                            f"(now: {datetime.datetime.now().isoformat()}) {url}\n"
                            f"STDERR:\n{stderr_output}"
                        ) from ex
                    time.sleep(0.1 * 2**i)
            else:
                raise ValueError("relay native binary did not start in time")

            yield {"url": url}
        finally:
            # Teardown: terminate gracefully, then force-kill if needed.
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                _log.warning("Relay process did not exit in time, killing")
                process.kill()
                process.wait(timeout=5)
            stdout_f.close()
            stderr_f.close()
    else:
        # Docker mode: run Relay in a container.
        from sentry.runner.commands.devservices import get_docker_client

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
                        f"relay did not start in time (now: {datetime.datetime.now().isoformat()}) {url}:\n{container.logs().decode()}"
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
