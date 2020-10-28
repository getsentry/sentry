from __future__ import absolute_import, print_function

import os

from click import Choice

LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL", "FATAL")


class CaseInsensitiveChoice(Choice):
    def convert(self, value, param, ctx):
        self.choices = [choice.upper() for choice in self.choices]
        return super(CaseInsensitiveChoice, self).convert(value.upper(), param, ctx)


def configuration(f):
    "Load and configure Sentry."
    import click
    from functools import update_wrapper

    @click.pass_context
    def inner(ctx, *args, **kwargs):
        # HACK: We can't call `configure()` from within tests
        # since we don't load config files from disk, so we
        # need a way to bypass this initialization step
        if os.environ.get("_SENTRY_SKIP_CONFIGURATION") != "1":
            from sentry.runner import configure

            configure()
        return ctx.invoke(f, *args, **kwargs)

    return update_wrapper(inner, f)


def log_options(default=None):
    def decorator(f):
        """
        Give ability to configure global logging level/format.
        Must be used before configuration.
        """
        import click
        from functools import update_wrapper
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
        def inner(ctx, loglevel=None, logformat=None, *args, **kwargs):
            if loglevel:
                os.environ["SENTRY_LOG_LEVEL"] = loglevel
            if logformat:
                os.environ["SENTRY_LOG_FORMAT"] = logformat.lower()
            return ctx.invoke(f, *args, **kwargs)

        return update_wrapper(inner, f)

    return decorator
