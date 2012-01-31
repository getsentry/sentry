"""
sentry.commands.upgrade
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.management import call_command
from django.conf import settings
from sentry.commands.utils import options, opt


@options(
    opt('--interactive', default=False, action='store_true'),
    opt('--delete-ghost-migrations', default=True, dest='delete_ghosts'),
)
def upgrade(interactive=True, delete_ghosts=True):
    call_command('syncdb', database='default', interactive=interactive)

    if 'south' in settings.INSTALLED_APPS:
        call_command('migrate', database='default', interactive=interactive, delete_ghosts=delete_ghosts)

    register_views()


def register_views():
    from sentry.views import View as ViewHandler
    from sentry.models import View

    for viewhandler in ViewHandler.objects.all():
        path = '%s.%s' % (viewhandler.__module__, viewhandler.__class__.__name__)

        defaults = dict(
            verbose_name=viewhandler.verbose_name,
            verbose_name_plural=viewhandler.verbose_name_plural,
        )

        # TODO: this should handle race conditions
        view, created = View.objects.get_or_create(
            path=path,
            defaults=defaults,
        )
        if created:
            continue

        save = False
        for k, v in defaults.iteritems():
            if getattr(view, k) != getattr(viewhandler, k):
                save = True
                setattr(view, k, v)

        if save:
            view.save()
