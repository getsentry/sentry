"""
sentry.management.commands.check_notifications
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from optparse import make_option

from django.core.management.base import BaseCommand, CommandError

from sentry.models import User


def find_mail_plugin():
    from sentry.plugins import plugins
    for plugin in plugins.all():
        if type(plugin).__name__.endswith('MailPlugin'):
            return plugin
    assert False, 'MailPlugin cannot be found'


def handle_project(plugin, project, stream):
    stream.write('# Project: %s\n' % project)
    from sentry.utils.email import get_email_addresses
    user_ids = plugin.get_sendable_users(project)
    users = User.objects.in_bulk(user_ids)
    for user_id, email in get_email_addresses(user_ids, project).items():
        stream.write('{}: {}\n'.format(users[user_id].username, email))


class Command(BaseCommand):
    help = 'Dump addresses that would get an email notification'

    option_list = BaseCommand.option_list + (
        make_option('--organization',
            action='store',
            type='int',
            dest='organization',
            default=0,
            help='',
        ),
        make_option('--project',
            action='store',
            type='int',
            dest='project',
            default=0,
            help='',
        ),
    )

    def handle(self, *args, **options):
        if not (options['project'] or options['organization']):
            raise CommandError('Must specify either a project or organization')

        from sentry.models import Project, Organization
        if options['organization']:
            projects = list(Organization.objects.get(pk=options['organization']).project_set.all())
        else:
            projects = [Project.objects.get(pk=options['project'])]

        plugin = find_mail_plugin()

        for project in projects:
            handle_project(plugin, project, self.stdout)
            self.stdout.write('\n')
