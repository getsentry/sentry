from __future__ import absolute_import

from django.core.files.uploadedfile import InMemoryUploadedFile, TemporaryUploadedFile
from symbolic import arch_from_breakpad, ProcessState, id_from_breakpad
from sentry.utils.dates import parse_timestamp

from sentry.utils.safe import get_path
import logging
import msgpack
from msgpack import UnpackException

minidumps_logger = logging.getLogger('sentry.minidumps')

# Attachment type used for minidump files
MINIDUMP_ATTACHMENT_TYPE = 'event.minidump'

# Mapping of well-known minidump OS constants to our internal names
MINIDUMP_OS_TYPES = {
    'Mac OS X': 'macOS',
    'Windows NT': 'Windows',
}


def is_minidump_event(data):
    exceptions = get_path(data, 'exception', 'values', filter=True)
    return get_path(exceptions, 0, 'mechanism', 'type') == 'minidump'


def process_minidump(minidump, cfi=None):
    if isinstance(minidump, InMemoryUploadedFile):
        minidump.open()  # seek to start
        return ProcessState.from_minidump_buffer(minidump.read(), cfi)
    elif isinstance(minidump, TemporaryUploadedFile):
        return ProcessState.from_minidump(minidump.temporary_file_path(), cfi)
    else:
        return ProcessState.from_minidump_buffer(minidump, cfi)


def merge_process_state_event(data, state, cfi=None):
    data['platform'] = 'native'
    data['level'] = 'fatal' if state.crashed else 'info'

    if state.timestamp:
        data['timestamp'] = float(state.timestamp)

    # Extract as much context information as we can.
    info = state.system_info
    context = data.setdefault('contexts', {})
    os = context.setdefault('os', {})
    device = context.setdefault('device', {})
    os['type'] = 'os'  # Required by "get_sdk_from_event"
    os['name'] = MINIDUMP_OS_TYPES.get(info.os_name, info.os_name)
    os['version'] = info.os_version
    os['build'] = info.os_build
    device['arch'] = arch_from_breakpad(info.cpu_family)

    # We can extract stack traces here already but since CFI is not
    # available yet (without debug symbols), the stackwalker will
    # resort to stack scanning which yields low-quality results. If
    # the user provides us with debug symbols, we reprocess this
    # minidump and add improved stacktraces later.
    data['threads'] = [{
        'id': thread.thread_id,
        'crashed': False,
        'stacktrace': {
            'frames': frames_from_minidump_thread(thread),
            'registers': thread.get_frame(0).registers if thread.frame_count else None,
        },
    } for thread in state.threads()]

    # Mark the crashed thread and add its stacktrace to the exception
    crashed_thread = data['threads'][state.requesting_thread]
    crashed_thread['crashed'] = True

    # Extract the crash reason and infos
    exc_value = 'Assertion Error: %s' % state.assertion if state.assertion \
        else 'Fatal Error: %s' % state.crash_reason
    data['exception'] = {
        'value': exc_value,
        'thread_id': crashed_thread['id'],
        'type': state.crash_reason,
        # Move stacktrace here from crashed_thread (mutating!)
        'stacktrace': crashed_thread.pop('stacktrace'),
        'mechanism': {
            'type': 'minidump',
            'handled': False,
            'synthetic': True,
            # We cannot extract exception codes or signals with the breakpad
            # extractor just yet. Once these capabilities are added to symbolic,
            # these values should go in the mechanism here.
        }
    }

    # Extract referenced (not all loaded) images
    images = [{
        'type': 'symbolic',
        'id': id_from_breakpad(module.id),
        'image_addr': '0x%x' % module.addr,
        'image_size': module.size,
        'name': module.name,
    } for module in state.modules() if is_valid_module_id(module.id)]
    data.setdefault('debug_meta', {})['images'] = images


def merge_attached_event(mpack_event, data):
    # Merge msgpack serialized event
    try:
        event = msgpack.unpack(mpack_event)
    except UnpackException as e:
        minidumps_logger.exception(e)
        return

    for key in event:
        value = event.get(key)
        if value is not None:
            data[key] = value


def merge_attached_breadcrumbs(mpack_breadcrumbs, data):
    try:
        unpacker = msgpack.Unpacker(mpack_breadcrumbs)
    except UnpackException as e:
        minidumps_logger.exception(e)
        return

    levels = {-1: 'debug', 0: 'info', 1: 'warning', 2: 'error', 3: 'critical'}
    breadcrumbs = []
    for crumb in unpacker:
        breadcrumbs.insert(0, {
            'timestamp': crumb.get('timestamp'),
            'category': crumb.get('category'),
            'type': crumb.get('type'),
            'level': levels.get(crumb.get('level', 0), 'info'),
            'message': crumb.get('message'),
        })

    if not breadcrumbs:
        return

    breadcrumbs.reverse()

    current_crumbs = data.get('breadcrumbs')
    if current_crumbs is None:
        data['breadcrumbs'] = breadcrumbs
        return

    current_crumb = next((c for c in reversed(current_crumbs)
                          if c.get('timestamp') is not None), None)
    new_crumb = next((c for c in reversed(breadcrumbs) if c.get('timestamp') is not None), None)
    if current_crumb is not None and new_crumb is not None:
        if parse_timestamp(current_crumb['timestamp']) > parse_timestamp(new_crumb['timestamp']):
            data['breadcrumbs'] = breadcrumbs + current_crumbs
        else:
            data['breadcrumbs'] = current_crumbs + breadcrumbs
    else:
        data['breadcrumbs'] = current_crumbs + breadcrumbs


def is_valid_module_id(id):
    return id is not None and id != '000000000000000000000000000000000'


def frames_from_minidump_thread(thread):
    return [{
        'instruction_addr': '0x%x' % frame.return_address,
        'function': '<unknown>',  # Required by interface
        'package': frame.module.name if frame.module else None,
        'trust': frame.trust,
    } for frame in reversed(list(thread.frames()))]
