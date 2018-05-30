from __future__ import absolute_import

import re
import six
import logging

from collections import namedtuple
from django.core.files.uploadedfile import InMemoryUploadedFile, TemporaryUploadedFile
from symbolic import parse_addr, arch_from_breakpad, arch_from_macho, arch_is_known, ProcessState, id_from_breakpad

from sentry.interfaces.contexts import DeviceContextType

logger = logging.getLogger(__name__)

KNOWN_DSYM_TYPES = {
    'iOS': 'macho',
    'tvOS': 'macho',
    'macOS': 'macho',
    'watchOS': 'macho',
}

# Regular expression to parse OS versions from a minidump OS string
VERSION_RE = re.compile(r'(\d+\.\d+\.\d+)\s+(.*)')

# Regular expression to guess whether we're dealing with Windows or Unix paths
WINDOWS_PATH_RE = re.compile(r'^[a-z]:\\', re.IGNORECASE)

# Mapping of well-known minidump OS constants to our internal names
MINIDUMP_OS_TYPES = {
    'Mac OS X': 'macOS',
    'Windows NT': 'Windows',
}

AppInfo = namedtuple('AppInfo', ['id', 'version', 'build', 'name'])


def image_name(pkg):
    split = '\\' if WINDOWS_PATH_RE.match(pkg) else '/'
    return pkg.rsplit(split, 1)[-1]


def find_all_stacktraces(data):
    """Given a data dictionary from an event this returns all
    relevant stacktraces in a list.  If a frame contains a raw_stacktrace
    property it's preferred over the processed one.
    """
    rv = []

    def _probe_for_stacktrace(container):
        raw = container.get('raw_stacktrace')
        if raw is not None:
            rv.append((raw, container))
        else:
            processed = container.get('stacktrace')
            if processed is not None:
                rv.append((processed, container))

    exc_container = data.get('sentry.interfaces.Exception')
    if exc_container:
        for exc in exc_container['values']:
            _probe_for_stacktrace(exc)

    # The legacy stacktrace interface does not support raw stacktraces
    stacktrace = data.get('sentry.interfaces.Stacktrace')
    if stacktrace:
        rv.append((stacktrace, None))

    threads = data.get('threads')
    if threads:
        for thread in threads['values']:
            _probe_for_stacktrace(thread)

    return rv


def get_sdk_from_event(event):
    sdk_info = (event.get('debug_meta') or {}).get('sdk_info')
    if sdk_info:
        return sdk_info
    os = (event.get('contexts') or {}).get('os')
    if os and os.get('type') == 'os':
        return get_sdk_from_os(os)


def get_sdk_from_os(data):
    if 'name' not in data or 'version' not in data:
        return
    try:
        version = six.text_type(data['version']).split('-', 1)[0] + '.0' * 3
        system_version = tuple(int(x) for x in version.split('.')[:3])
    except ValueError:
        return

    return {
        'sdk_name': data['name'],
        'version_major': system_version[0],
        'version_minor': system_version[1],
        'version_patchlevel': system_version[2],
        'build': data.get('build'),
    }


def cpu_name_from_data(data):
    """Returns the CPU name from the given data if it exists."""
    device = DeviceContextType.primary_value_for_data(data)
    if device:
        arch = device.get('arch')
        if isinstance(arch, six.string_types):
            return arch

    # TODO: kill this here.  we want to not support that going forward
    unique_cpu_name = None
    images = (data.get('debug_meta') or {}).get('images') or []
    for img in images:
        if img.get('arch') and arch_is_known(img['arch']):
            cpu_name = img['arch']
        elif img.get('cpu_type') is not None \
                and img.get('cpu_subtype') is not None:
            cpu_name = arch_from_macho(img['cpu_type'], img['cpu_subtype'])
        else:
            cpu_name = None
        if unique_cpu_name is None:
            unique_cpu_name = cpu_name
        elif unique_cpu_name != cpu_name:
            unique_cpu_name = None
            break

    return unique_cpu_name


def version_build_from_data(data):
    """Returns release and build string from the given data if it exists."""
    app_context = data.get('contexts', {}).get('app', {})
    if app_context is not None:
        if (app_context.get('app_identifier', None) and
                app_context.get('app_version', None) and
                app_context.get('app_build', None) and
                app_context.get('app_name', None)):
            return AppInfo(
                app_context.get('app_identifier', None),
                app_context.get('app_version', None),
                app_context.get('app_build', None),
                app_context.get('app_name', None),
            )
    return None


def rebase_addr(instr_addr, obj):
    return parse_addr(instr_addr) - parse_addr(obj.addr)


def sdk_info_to_sdk_id(sdk_info):
    if sdk_info is None:
        return None
    rv = '%s_%d.%d.%d' % (
        sdk_info['sdk_name'], sdk_info['version_major'], sdk_info['version_minor'],
        sdk_info['version_patchlevel'],
    )
    build = sdk_info.get('build')
    if build is not None:
        rv = '%s_%s' % (rv, build)
    return rv


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
