from __future__ import annotations

import contextlib
import json  # noqa
import os
import sys
from collections.abc import Generator
from typing import TYPE_CHECKING, ContextManager, int

import click

if TYPE_CHECKING:
    import docker

CI = os.environ.get("CI") is not None

# assigned as a constant so mypy's "unreachable" detection doesn't fail on linux
# https://github.com/python/mypy/issues/12286
DARWIN = sys.platform == "darwin"

if DARWIN:
    RAW_SOCKET_PATH = os.path.expanduser("~/.colima/default/docker.sock")
else:
    RAW_SOCKET_PATH = "/var/run/docker.sock"


# NOTE: we can delete the docker python client dependency if we port all usage of this
#       to docker cli calls
@contextlib.contextmanager
def get_docker_client() -> Generator[docker.DockerClient]:
    import docker

    def _client() -> ContextManager[docker.DockerClient]:
        return contextlib.closing(docker.DockerClient(base_url=f"unix://{RAW_SOCKET_PATH}"))

    with contextlib.ExitStack() as ctx:
        try:
            client = ctx.enter_context(_client())
        except docker.errors.DockerException:
            if DARWIN:
                raise click.ClickException(
                    "Make sure colima is running. Run `devenv colima start`."
                )
            else:
                raise click.ClickException("Make sure docker is running.")

        yield client


# compatibility stub
@click.command()
@click.argument("args", nargs=-1)
def devservices(args: tuple[str, ...]) -> None:
    return
