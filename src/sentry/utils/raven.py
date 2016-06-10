from __future__ import absolute_import, print_function

import copy
import inspect
import logging
import raven
import sentry

from django.conf import settings
from django.db.utils import DatabaseError
from raven.contrib.django.client import DjangoClient

from . import metrics

UNSAFE_FILES = (
    'sentry/event_manager.py',
    'sentry/tasks/process_buffer.py',
)


def is_current_event_safe():
    """
    Tests the current stack for unsafe locations that would likely cause
    recursion if an attempt to send to Sentry was made.
    """
    for _, filename, _, _, _, _ in inspect.stack():
        if filename.endswith(UNSAFE_FILES):
            return False
    return True


class SentryInternalClient(DjangoClient):
    def is_enabled(self):
        if getattr(settings, 'DISABLE_RAVEN', False):
            return False
        return settings.SENTRY_PROJECT is not None

    def can_record_current_event(self):
        return self.remote.is_active() or is_current_event_safe()

    def capture(self, *args, **kwargs):
        if not self.can_record_current_event():
            metrics.incr('internal.uncaptured.events')
            self.error_logger.error('Not capturing event due to unsafe stacktrace:\n%r', kwargs)
            return
        return super(SentryInternalClient, self).capture(*args, **kwargs)

    def send(self, **kwargs):
        # TODO(dcramer): this should respect rate limits/etc and use the normal
        # pipeline

        # Report the issue to an upstream Sentry if active
        # NOTE: we don't want to check self.is_enabled() like normal, since
        # is_enabled behavior is overridden in this class. We explicitly
        # want to check if the remote is active.
        if self.remote.is_active():
            from sentry import options
            # Append some extra tags that are useful for remote reporting
            super_kwargs = copy.deepcopy(kwargs)
            super_kwargs['tags']['install-id'] = options.get('sentry:install-id')
            super(SentryInternalClient, self).send(**super_kwargs)

        if not is_current_event_safe():
            return

        from sentry.app import tsdb
        from sentry.coreapi import ClientApiHelper
        from sentry.event_manager import EventManager
        from sentry.models import Project

        helper = ClientApiHelper(
            agent='raven-python/%s (sentry %s)' % (raven.VERSION, sentry.VERSION),
            project_id=settings.SENTRY_PROJECT,
            version=self.protocol_version,
        )

        try:
            project = Project.objects.get_from_cache(id=settings.SENTRY_PROJECT)
        except DatabaseError:
            self.error_logger.error('Unable to fetch internal project',
                                    exc_info=True)
            return
        except Project.DoesNotExist:
            self.error_logger.error('Internal project (id=%s) does not exist',
                                    settings.SENTRY_PROJECT)
            return
        except Exception:
            self.error_logger.error(
                'Unable to fetch internal project for some unknown reason',
                exc_info=True)
            return

        helper.context.bind_project(project)

        metrics.incr('events.total')

        kwargs['project'] = project.id
        try:
            # This in theory is the right way to do it because validate
            # also normalizes currently, but we just send in data already
            # normalised in the raven client now.
            # data = helper.validate_data(project, kwargs)
            data = kwargs
            manager = EventManager(data)
            data = manager.normalize()
            tsdb.incr_multi([
                (tsdb.models.project_total_received, project.id),
                (tsdb.models.organization_total_received, project.organization_id),
            ])
            helper.insert_data_to_database(data)
        except Exception as e:
            if self.raise_send_errors:
                raise
            message = kwargs.get('message')
            if not message:
                msg_interface = kwargs.get('sentry.interface.Message', {})
                message = msg_interface.get('formatted', msg_interface.get('message', 'unknown error'))
            self.error_logger.error(
                'Unable to record event: %s\nEvent was: %r', e,
                message, exc_info=True)


class SentryInternalFilter(logging.Filter):
    def filter(self, record):
        # TODO(mattrobenolt): handle an upstream Sentry
        metrics.incr('internal.uncaptured.logs')
        return is_current_event_safe()
