from __future__ import absolute_import
from django.core.files.uploadedfile import InMemoryUploadedFile, TemporaryUploadedFile

from symbolic import arch_from_breakpad, ProcessState, id_from_breakpad


# Mapping of well-known minidump OS constants to our internal names
MINIDUMP_OS_TYPES = {
    'Mac OS X': 'macOS',
    'Windows NT': 'Windows',
}


def merge_minidump_event(data, minidump):
    if isinstance(minidump, InMemoryUploadedFile):
        minidump.open()  # seek to start
        state = ProcessState.from_minidump_buffer(minidump.read())
    elif isinstance(minidump, TemporaryUploadedFile):
        state = ProcessState.from_minidump(minidump.temporary_file_path())
    else:
        state = ProcessState.from_minidump(minidump)

    data['platform'] = 'native'
    data['level'] = 'fatal' if state.crashed else 'info'
    data['message'] = 'Assertion Error: %s' % state.assertion if state.assertion \
        else 'Fatal Error: %s' % state.crash_reason

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
    # the user provides us with debug symbols, we could reprocess this
    # minidump and add improved stacktraces later.
    data['threads'] = [{
        'id': thread.thread_id,
        'crashed': False,
        'stacktrace': {
            'frames': [{
                'instruction_addr': '0x%x' % frame.return_address,
                'function': '<unknown>',  # Required by interface
                'package': frame.module.name if frame.module else None,
            } for frame in reversed(list(thread.frames()))],
            'registers': thread.get_frame(0).registers if thread.frame_count else None,
        },
    } for thread in state.threads()]

    # Mark the crashed thread and add its stacktrace to the exception
    crashed_thread = data['threads'][state.requesting_thread]
    crashed_thread['crashed'] = True

    # Extract the crash reason and infos
    data['exception'] = {
        'value': data['message'],
        'thread_id': crashed_thread['id'],
        'type': state.crash_reason,
        # Move stacktrace here from crashed_thread (mutating!)
        'stacktrace': crashed_thread.pop('stacktrace'),
        'mechanism': {
            'type': 'minidump',
            'handled': False,
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
    } for module in state.modules()]
    data.setdefault('debug_meta', {})['images'] = images
