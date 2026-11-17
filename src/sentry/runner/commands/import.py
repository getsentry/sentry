# `sentry import` is defined in backup.py, next to the code it shares.
from sentry.runner.commands.backup import import_ as command

__all__ = ("command",)
