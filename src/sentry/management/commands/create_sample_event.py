"""
sentry.management.commands.create_sample_event
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.core.management.base import BaseCommand, CommandError, make_option


class Command(BaseCommand):
    help = 'Creates a sample event in Sentry (if applicable)'

    option_list = BaseCommand.option_list + (
        make_option('--project', dest='project', help="project ID or team-slug/project-slug"),
        make_option('--platform', dest='platform'),
    )

    def handle(self, **options):
        from django.conf import settings
        from sentry.models import Project
        from sentry.utils.samples import create_sample_event

        if not options['project']:
            project = Project.objects.get(id=settings.SENTRY_PROJECT)
        else:
            if options['project'].isdigit():
                project = Project.objects.get(id=options['project'])
            elif '/' in options['project']:
                t_slug, p_slug = options['project'].split('/', 1)
                project = Project.objects.get(slug=p_slug, team__slug=t_slug)
            else:
                raise CommandError('Project must be specified as team-slug/project-slug or a project id')

        platform = options['platform']
        event = create_sample_event(project, platform)
        if not event:
            raise CommandError('Unable to create an event for platform %r' % (platform,))

        self.stdout.write('Event created: %s' % (event.group.get_absolute_url(),))
