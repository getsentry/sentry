from __future__ import annotations

import os
from typing import Any

import click

from sentry.utils.imports import import_string


def configure(*, skip_service_validation: bool = False) -> None:
    """
    Kick things off and configure all the things.

    A guess is made as to whether the entrypoint is coming from Click
    or from another invocation of `configure()`. If Click, we're able
    to pass along the Click context object.
    """
    from .settings import configure as _configure
    from .settings import discover_configs

    try:
        ctx = click.get_current_context()
    except RuntimeError:
        ctx = None
    _, py, yaml = discover_configs()

    # TODO(mattrobenolt): Surface this also as a CLI option?
    skip_service_validation = skip_service_validation or (
        "SENTRY_SKIP_BACKEND_VALIDATION" in os.environ
        or "SENTRY_SKIP_SERVICE_VALIDATION" in os.environ
    )
    _configure(ctx, py, yaml, skip_service_validation)


class UnknownCommand(ImportError):
    pass


def call_command(name: str, obj: object = None, **kwargs: Any) -> None:
    try:
        command = import_string(name)
    except (ImportError, AttributeError):
        raise UnknownCommand(name)

    with command.make_context("sentry", [], obj=obj or {}) as ctx:
        ctx.params.update(kwargs)
        try:
            command.invoke(ctx)
        except click.Abort:
            click.echo("Aborted!", err=True)
