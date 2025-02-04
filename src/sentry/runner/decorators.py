import os
from collections.abc import Callable
from typing import Concatenate, ParamSpec, TypeVar

import click

P = ParamSpec("P")
R = TypeVar("R")

LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL", "FATAL")


class CaseInsensitiveChoice(click.Choice):
    def convert(self, value: str, param: click.Parameter | None, ctx: click.Context | None) -> str:
        self.choices = [choice.upper() for choice in self.choices]
        return super().convert(value.upper(), param, ctx)


def configuration(f: Callable[P, R]) -> Callable[P, R]:
    "Load and configure Sentry."
    from functools import update_wrapper

    import click

    @click.pass_context
    def inner(ctx: click.Context, *args: P.args, **kwargs: P.kwargs) -> R:
        # HACK: We can't call `configure()` from within tests
        # since we don't load config files from disk, so we
        # need a way to bypass this initialization step
        if os.environ.get("_SENTRY_SKIP_CONFIGURATION") != "1":
            from sentry.runner import configure

            configure()
        return ctx.invoke(f, *args, **kwargs)

    return update_wrapper(inner, f)


def log_options(
    default: str | None = None,
) -> Callable[[Callable[P, R]], Callable[Concatenate[str | None, str | None, P], R]]:
    def decorator(f: Callable[P, R]) -> Callable[Concatenate[str | None, str | None, P], R]:
        """
        Give ability to configure global logging level/format.
        Must be used before configuration.
        """
        from functools import update_wrapper

        import click

        from sentry.logging import LoggingFormat

        formats = [LoggingFormat.HUMAN, LoggingFormat.MACHINE]

        @click.pass_context
        @click.option(
            "--loglevel",
            "-l",
            default=default,
            help="Global logging level. Use wisely.",
            envvar="SENTRY_LOG_LEVEL",
            type=CaseInsensitiveChoice(LOG_LEVELS),
        )
        @click.option(
            "--logformat",
            default=default,
            help="Log line format.",
            envvar="SENTRY_LOG_FORMAT",
            type=CaseInsensitiveChoice(formats),
        )
        def inner(
            ctx: click.Context,
            loglevel: str | None = None,
            logformat: str | None = None,
            *args: P.args,
            **kwargs: P.kwargs,
        ) -> R:
            if loglevel:
                os.environ["SENTRY_LOG_LEVEL"] = loglevel
            if logformat:
                os.environ["SENTRY_LOG_FORMAT"] = logformat.lower()
            return ctx.invoke(f, *args, **kwargs)

        return update_wrapper(inner, f)

    return decorator
