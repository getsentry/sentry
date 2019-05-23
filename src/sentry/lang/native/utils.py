from __future__ import absolute_import

import re
import six
import logging
import posixpath

from collections import namedtuple
from symbolic import LineInfo, parse_addr

from sentry.interfaces.contexts import DeviceContextType
from sentry.stacktraces.functions import trim_function_name
from sentry.utils.safe import get_path, trim

logger = logging.getLogger(__name__)

# Regex to parse OS versions from a minidump OS string.
VERSION_RE = re.compile(r'(\d+\.\d+\.\d+)\s+(.*)')

# Regex to guess whether we're dealing with Windows or Unix paths.
WINDOWS_PATH_RE = re.compile(r'^([a-z]:\\|\\\\)', re.IGNORECASE)

AppInfo = namedtuple('AppInfo', ['id', 'version', 'build', 'name'])


def image_name(pkg):
    if not pkg:
        return pkg
    split = '\\' if WINDOWS_PATH_RE.match(pkg) else '/'
    return pkg.rsplit(split, 1)[-1]


def get_sdk_from_event(event):
    sdk_info = get_path(event, 'debug_meta', 'sdk_info')
    if sdk_info:
        return sdk_info

    os = get_path(event, 'contexts', 'os')
    if os and os.get('type') == 'os':
        return get_sdk_from_os(os)


def get_sdk_from_os(data):
    if data.get('name') is None or data.get('version') is None:
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
    if device and device.get('arch'):
        return device['arch']

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


def signal_from_data(data):
    exceptions = get_path(data, 'exception', 'values', filter=True)
    signal = get_path(exceptions, 0, 'mechanism', 'meta', 'signal', 'number')
    if signal is not None:
        return int(signal)

    return None


def merge_symbolicated_frame(new_frame, sfrm):
    if sfrm.get('function'):
        raw_func = trim(sfrm['function'], 256)
        func = trim(trim_function_name(sfrm['function'], 'native'), 256)

        # if function and raw function match, we can get away without
        # storing a raw function
        if func == raw_func:
            new_frame['function'] = raw_func
        # otherwise we store both
        else:
            new_frame['raw_function'] = raw_func
            new_frame['function'] = func
    if sfrm.get('instruction_addr'):
        new_frame['instruction_addr'] = sfrm['instruction_addr']
    if sfrm.get('symbol'):
        new_frame['symbol'] = sfrm['symbol']
    if sfrm.get('abs_path'):
        new_frame['abs_path'] = sfrm['abs_path']
        new_frame['filename'] = posixpath.basename(sfrm['abs_path'])
    if sfrm.get('filename'):
        new_frame['filename'] = sfrm['filename']
    if sfrm.get('lineno'):
        new_frame['lineno'] = sfrm['lineno']
    if sfrm.get('colno'):
        new_frame['colno'] = sfrm['colno']
    if sfrm.get('package'):
        new_frame['package'] = sfrm['package']
    if sfrm.get('trust'):
        new_frame['trust'] = sfrm['trust']
    if sfrm.get('status'):
        frame_meta = new_frame.setdefault('data', {})
        frame_meta['symbolicator_status'] = sfrm['status']


def convert_ios_symbolserver_match(instruction_addr, symbolserver_match):
    if not symbolserver_match:
        return []

    symbol = symbolserver_match['symbol']
    if symbol[:1] == '_':
        symbol = symbol[1:]

    # We still use this construct from symbolic for demangling (at least)
    line_info = LineInfo(
        sym_addr=parse_addr(symbolserver_match['addr']),
        instr_addr=parse_addr(instruction_addr),
        line=None,
        lang=None,
        symbol=symbol
    )

    function = line_info.function_name
    package = symbolserver_match['object_name']

    return {
        'sym_addr': '0x%x' % (line_info.sym_addr,),
        'instruction_addr': '0x%x' % (line_info.instr_addr,),
        'function': function,
        'symbol': symbol if function != symbol else None,
        'filename': trim(line_info.rel_path, 256),
        'abs_path': trim(line_info.abs_path, 256),
        'package': package,
    }
