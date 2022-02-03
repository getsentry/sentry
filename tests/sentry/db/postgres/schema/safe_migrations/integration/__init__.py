from django.core.management.commands.migrate import Command as MigrateCommand


def migrate(params=None):
    command = MigrateCommand()
    parser = command.create_parser("manage.py", "migrate")
    options = parser.parse_args(params or [])
    cmd_options = vars(options)
    return command.execute(**cmd_options)
