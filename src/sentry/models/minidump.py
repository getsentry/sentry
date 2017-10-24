"""
sentry.models.minidump
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db import models, transaction
from symbolic import ProcessState

from sentry.constants import LOG_LEVELS_MAP
from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.models.file import File


class MinidumpFile(Model):
    __core__ = False

    file = FlexibleForeignKey('sentry.File')
    event_id = models.CharField(max_length=36, unique=True)

    class Meta:
        db_table = 'sentry_minidumpfile'
        app_label = 'sentry'

    __repr__ = sane_repr('event_id')

    def delete(self, *args, **kwargs):
        super(MinidumpFile, self).delete(*args, **kwargs)
        self.file.delete()


def upload_minidump(fileobj, event_id):
    """Creates a new minidump file object and stores it."""
    with transaction.atomic():
        file = File.objects.create(
            name=event_id,
            type='event.minidump',
            headers={'Content-Type': 'application/x-minidump'},
        )

        file.putfile(fileobj)

        return MinidumpFile.objects.create(
            file=file,
            event_id=event_id,
        )


def merge_minidump_event(data, minidump_path):
    state = ProcessState.from_minidump(minidump_path)

    data['level'] = LOG_LEVELS_MAP['fatal'] if state.crashed else LOG_LEVELS_MAP['info']
    data['message'] = 'Assertion Error: %s' % state.assertion if state.assertion \
        else 'Fatal Error: %s' % state.crash_reason

    if state.timestamp:
        data['timestamp'] = float(state.timestamp)

    # Extract as much system information as we can. TODO: We should create
    # a custom context and implement a specific minidump view in the event
    # UI.
    info = state.system_info
    context = data.setdefault('contexts', {})
    os = context.setdefault('os', {})
    device = context.setdefault('device', {})
    os['name'] = info.os_name
    os['version'] = info.os_version
    device['arch'] = info.cpu_family

    # We can extract stack traces here already but since CFI is not
    # available yet (without debug symbols), the stackwalker will
    # resort to stack scanning which yields low-quality results. If
    # the user provides us with debug symbols, we will reprocess this
    # minidump and add improved stacktraces later.
    threads = [{
        'id': thread.thread_id,
        'crashed': False,
        'stacktrace': {
            'frames': [{
                'instruction_addr': frame.instruction,
                'function': '<unknown>',  # Required by interface
            } for frame in thread.frames()],
        },
    } for thread in state.threads()]
    data.setdefault('threads', {})['values'] = threads

    # Mark the crashed thread and add its stacktrace to the exception
    crashed_thread = threads[state.requesting_thread]
    crashed_thread['crashed'] = True

    # Extract the crash reason and infos
    exception = {
        'value': data['message'],
        'thread_id': crashed_thread['id'],
        'type': state.crash_reason,
        'stacktrace': crashed_thread['stacktrace'],
    }

    data.setdefault('exception', {}) \
        .setdefault('values', []) \
        .append(exception)

    # Extract referenced (not all loaded) images
    images = [{
        'type': 'apple',  # Required by interface
        'uuid': module.uuid,
        'image_addr': module.addr,
        'image_size': module.size,
        'name': module.name,
    } for module in state.modules()]
    data.setdefault('debug_meta', {})['images'] = images
