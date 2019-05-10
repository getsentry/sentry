from __future__ import absolute_import

import logging

from django.core.files.uploadedfile import InMemoryUploadedFile, TemporaryUploadedFile

import dateutil.parser as dp
from msgpack import unpack, Unpacker, UnpackException, ExtraData
from symbolic import normalize_arch, ProcessState, id_from_breakpad

from sentry.lang.native.utils import get_sdk_from_event, handle_symbolication_failed, merge_symbolicated_frame
from sentry.lang.native.symbolicator import merge_symbolicator_image
from sentry.attachments import attachment_cache
from sentry.coreapi import cache_key_for_event
from sentry.utils.safe import get_path, set_path

minidumps_logger = logging.getLogger('sentry.minidumps')

# Attachment type used for minidump files
MINIDUMP_ATTACHMENT_TYPE = 'event.minidump'

MAX_MSGPACK_BREADCRUMB_SIZE_BYTES = 50000
MAX_MSGPACK_EVENT_SIZE_BYTES = 100000

# Mapping of well-known minidump OS constants to our internal names
MINIDUMP_OS_TYPES = {
    'Mac OS X': 'macOS',
    'Windows NT': 'Windows',
}

# Mapping of well-known minidump OS constants to image file formats
MINIDUMP_IMAGE_TYPES = {
    'Windows': 'pe',
    'Windows NT': 'pe',
    'iOS': 'macho',
    'Mac OS X': 'macho',
    'Linux': 'elf',
    'Solaris': 'elf',
    'Android': 'elf',
}


def is_minidump_event(data):
    exceptions = get_path(data, 'exception', 'values', filter=True)
    return get_path(exceptions, 0, 'mechanism', 'type') in ('minidump', 'unreal')


def is_unreal_exception_stacktrace(data):
    exceptions = get_path(data, 'exception', 'values', filter=True)
    return get_path(exceptions, 0, 'mechanism', 'type') == 'unreal'


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
    device['arch'] = normalize_arch(info.cpu_family)

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
    data['exception'] = {'values': [{
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
    }]}

    # Extract referenced (not all loaded) images
    images = [{
        'type': MINIDUMP_IMAGE_TYPES.get(info.os_name, 'symbolic'),
        'code_id': module.code_id,
        'code_file': module.code_file,
        'debug_id': id_from_breakpad(module.debug_id),
        'debug_file': module.debug_file,
        'image_addr': '0x%x' % module.addr,
        'image_size': module.size,
    } for module in state.modules() if module.debug_id]
    data.setdefault('debug_meta', {})['images'] = images


def merge_attached_event(mpack_event, data):
    # Merge msgpack serialized event.
    if mpack_event.size > MAX_MSGPACK_EVENT_SIZE_BYTES:
        return

    try:
        event = unpack(mpack_event)
    except (UnpackException, ExtraData) as e:
        minidumps_logger.exception(e)
        return

    for key in event:
        value = event.get(key)
        if value is not None:
            data[key] = value


def merge_attached_breadcrumbs(mpack_breadcrumbs, data):
    # Merge msgpack breadcrumb file.
    if mpack_breadcrumbs.size > MAX_MSGPACK_BREADCRUMB_SIZE_BYTES:
        return

    try:
        unpacker = Unpacker(mpack_breadcrumbs)
        breadcrumbs = list(unpacker)
    except (UnpackException, ExtraData) as e:
        minidumps_logger.exception(e)
        return

    if not breadcrumbs:
        return

    current_crumbs = data.get('breadcrumbs')
    if not current_crumbs:
        data['breadcrumbs'] = breadcrumbs
        return

    current_crumb = next((c for c in reversed(current_crumbs)
                          if isinstance(c, dict) and c.get('timestamp') is not None), None)
    new_crumb = next((c for c in reversed(breadcrumbs) if isinstance(
        c, dict) and c.get('timestamp') is not None), None)

    # cap the breadcrumbs to the highest count of either file
    cap = max(len(current_crumbs), len(breadcrumbs))

    if current_crumb is not None and new_crumb is not None:
        if dp.parse(current_crumb['timestamp']) > dp.parse(new_crumb['timestamp']):
            data['breadcrumbs'] = breadcrumbs + current_crumbs
        else:
            data['breadcrumbs'] = current_crumbs + breadcrumbs
    else:
        data['breadcrumbs'] = current_crumbs + breadcrumbs

    data['breadcrumbs'] = data['breadcrumbs'][-cap:]


def frames_from_minidump_thread(thread):
    return [{
        'instruction_addr': '0x%x' % frame.return_address,
        'package': frame.module.code_file if frame.module else None,
        'trust': frame.trust,
    } for frame in reversed(list(thread.frames()))]


def get_attached_minidump(data):
    cache_key = cache_key_for_event(data)
    attachments = attachment_cache.get(cache_key) or []
    return next((a for a in attachments if a.type == MINIDUMP_ATTACHMENT_TYPE), None)


def merge_symbolicator_minidump_response(data, response):
    sdk_info = get_sdk_from_event(data)

    # TODO(markus): Add OS context here when `merge_process_state_event` is no
    # longer called for symbolicator projects

    images = []
    set_path(data, 'debug_meta', 'images', value=images)

    for complete_image in response['modules']:
        image = {}
        merge_symbolicator_image(
            image, complete_image, sdk_info,
            lambda e: handle_symbolication_failed(e, data=data)
        )
        images.append(image)

    data_threads = []
    data['threads'] = {'values': data_threads}

    data_exception = get_path(data, 'exception', 'values', 0)

    for complete_stacktrace in response['stacktraces']:
        is_requesting = complete_stacktrace.get('is_requesting')
        thread_id = complete_stacktrace.get('thread_id')

        data_thread = {
            'id': thread_id,
            'crashed': is_requesting,
        }
        data_threads.append(data_thread)

        if is_requesting:
            data_stacktrace = get_path(data_exception, 'stacktrace')
            assert isinstance(data_stacktrace, dict), data_stacktrace
            # Make exemption specifically for unreal portable callstacks
            # TODO(markus): Allow overriding stacktrace more generically
            # (without looking into unreal context) once we no longer parse
            # minidump in the endpoint (right now we can't distinguish that
            # from user json).
            if data_stacktrace['frames'] and is_unreal_exception_stacktrace(data):
                continue
            del data_stacktrace['frames'][:]
        else:
            data_thread['stacktrace'] = data_stacktrace = {'frames': []}

        if complete_stacktrace.get('registers'):
            data_stacktrace['registers'] = complete_stacktrace['registers']

        for complete_frame in reversed(complete_stacktrace['frames']):
            new_frame = {}
            merge_symbolicated_frame(new_frame, complete_frame)
            data_stacktrace['frames'].append(new_frame)

    # TODO(markus): Add exception data here once merge_process_state_event is gone
