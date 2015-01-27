from __future__ import absolute_import

from django.core.management.commands.runserver import Command as RunserverCommand


class Command(RunserverCommand):
    """
    ALmost identical to the built-in runserver except that we don't hijack
    static files.
    """
    help = "Starts a lightweight Web server for development"
