from __future__ import absolute_import

import logging

import dateutil.parser as dp
from msgpack import unpack, Unpacker, UnpackException, ExtraData

from sentry.lang.native.utils import get_sdk_from_event, handle_symbolication_failed, merge_symbolicated_frame
from sentry.lang.native.symbolicator import merge_symbolicator_image
from sentry.lang.native.symbolizer import SymbolicationFailed
from sentry.models.eventerror import EventError
from sentry.attachments import attachment_cache
from sentry.coreapi import cache_key_for_event
from sentry.utils.safe import get_path, set_path, setdefault_path

minidumps_logger = logging.getLogger('sentry.minidumps')

# Attachment type used for minidump files
MINIDUMP_ATTACHMENT_TYPE = 'event.minidump'

MAX_MSGPACK_BREADCRUMB_SIZE_BYTES = 50000
MAX_MSGPACK_EVENT_SIZE_BYTES = 100000


def is_minidump_event(data):
    exceptions = get_path(data, 'exception', 'values', filter=True)
    return get_path(exceptions, 0, 'mechanism', 'type') in ('minidump', 'unreal')


def write_minidump_placeholder(data):
    # Minidump events must be native platform.
    data['platform'] = 'native'

    # Assume that this minidump is the result of a crash and assign the fatal
    # level. Note that the use of `setdefault` here doesn't generally allow the
    # user to override the minidump's level as processing will overwrite it
    # later.
    setdefault_path(data, 'level', value='fatal')

    # Create a placeholder exception. This signals normalization that this is an
    # error event and also serves as a placeholder if processing of the minidump
    # fails.
    exception = {
        'type': 'Minidump',
        'value': 'Invalid Minidump',
        'mechanism': {
            'type': 'minidump',
            'handled': False,
            'synthetic': True,
        }
    }
    data['exception'] = {'values': [exception]}


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


def get_attached_minidump(data):
    cache_key = cache_key_for_event(data)
    attachments = attachment_cache.get(cache_key) or []
    return next((a for a in attachments if a.type == MINIDUMP_ATTACHMENT_TYPE), None)


def merge_symbolicator_minidump_system_info(data, system_info):
    set_path(data, 'contexts', 'os', 'type', value='os')  # Required by "get_sdk_from_event"
    setdefault_path(data, 'contexts', 'os', 'name', value=system_info.get('os_name'))
    setdefault_path(data, 'contexts', 'os', 'version', value=system_info.get('os_version'))
    setdefault_path(data, 'contexts', 'os', 'build', value=system_info.get('os_build'))

    set_path(data, 'contexts', 'device', 'type', value='device')
    setdefault_path(data, 'contexts', 'device', 'arch', value=system_info.get('cpu_arch'))


def merge_symbolicator_minidump_response(data, response):
    sdk_info = get_sdk_from_event(data)

    data['platform'] = 'native'
    if response.get('crashed') is not None:
        data['level'] = 'fatal' if response['crashed'] else 'info'

    if response.get('timestamp'):
        data['timestamp'] = float(response['timestamp'])

    if response.get('system_info'):
        merge_symbolicator_minidump_system_info(data, response['system_info'])

    images = []
    set_path(data, 'debug_meta', 'images', value=images)

    for complete_image in response['modules']:
        image = {}
        merge_symbolicator_image(
            image, complete_image, sdk_info,
            lambda e: handle_symbolication_failed(e, data=data)
        )
        images.append(image)

    # Extract the crash reason and infos
    data_exception = get_path(data, 'exception', 'values', 0)
    exc_value = (
        'Assertion Error: %s' % response.get('assertion')
        if response.get('assertion')
        else 'Fatal Error: %s' % response.get('crash_reason')
    )
    data_exception['value'] = exc_value
    data_exception['type'] = response.get('crash_reason')

    data_threads = []
    if response['stacktraces']:
        data['threads'] = {'values': data_threads}
    else:
        error = SymbolicationFailed(message='minidump has no thread list',
                                    type=EventError.NATIVE_SYMBOLICATOR_FAILED)
        handle_symbolication_failed(error, data=data)

    for complete_stacktrace in response['stacktraces']:
        is_requesting = complete_stacktrace.get('is_requesting')
        thread_id = complete_stacktrace.get('thread_id')

        data_thread = {
            'id': thread_id,
            'crashed': is_requesting,
        }
        data_threads.append(data_thread)

        if is_requesting:
            data_exception['thread_id'] = thread_id
            data_stacktrace = data_exception.setdefault('stacktrace', {})
            data_stacktrace['frames'] = []
        else:
            data_thread['stacktrace'] = data_stacktrace = {'frames': []}

        if complete_stacktrace.get('registers'):
            data_stacktrace['registers'] = complete_stacktrace['registers']

        for complete_frame in reversed(complete_stacktrace['frames']):
            new_frame = {}
            merge_symbolicated_frame(new_frame, complete_frame)
            data_stacktrace['frames'].append(new_frame)
