from django.core.management.commands.runserver import Command as RunserverCommand


class Command(RunserverCommand):
    help = "Starts a lightweight Web server for development and also serves static files."
