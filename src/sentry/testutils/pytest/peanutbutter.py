# Fixtures used to interact with a test peanutbutter server

from os import environ

# import grpc
import pytest

from sentry.runner.commands.devservices import get_docker_client

PEANUTBUTTER_TEST_IMAGE = environ.get(
    "PEANUTBUTTER_TEST_IMAGE",
    # TODO: make sure we tag the `latest`/`nightly` build
    "us.gcr.io/sentryio/peanutbutter:2243c86d22af46b9d267b9ac800d4cf62ee8927b",
)


def _peanutbutter_server_container_name():
    return "sentry_test_peanutbutter_server"


# FIXME: copied from `relay.py`, but maybe this should be a generic util?
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
def peanutbutter_server_setup():
    with get_docker_client() as docker_client:
        container_name = _peanutbutter_server_container_name()
        _remove_container_if_exists(docker_client, container_name)

    # FIXME: I thought you can just re-map ports in docker?
    # The service "internally" listens on `50051`,
    # but we would like to bind a different "random" port instead.
    test_port = 50051
    options = {
        "image": PEANUTBUTTER_TEST_IMAGE,
        "ports": {f"{test_port}/tcp": 50051},
        "network": "sentry",
        "detach": True,
        "name": container_name,
    }

    # Some structure similar to what the live_server fixture returns
    server_info = {"target": f"127.0.0.1:{test_port}", "options": options}

    yield server_info

    # cleanup
    with get_docker_client() as docker_client:
        _remove_container_if_exists(docker_client, container_name)


@pytest.fixture(scope="function")
def peanutbutter_server(peanutbutter_server_setup):
    options = peanutbutter_server_setup["options"]
    with get_docker_client() as docker_client:
        container_name = _peanutbutter_server_container_name()
        _remove_container_if_exists(docker_client, container_name)
        docker_client.containers.run(**options)

    target = peanutbutter_server_setup["target"]

    # FIXME: "in theory", we can wait here to check that the
    # connection is ready. But it seems we don’t need to.
    # channel = grpc.insecure_channel(target)
    # ready_future = grpc.channel_ready_future(channel)

    # ready_future._block(None)  # NOTE: looks like this is not a std `Future`

    return {"target": target}
