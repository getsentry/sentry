"""
Worker child process bootstrap.

Bootstraps sentry with configure() and then imports the task app
"""

from sentry.runner import configure

configure()

from sentry.taskworker.runtime import app

__all__ = ("app",)
