from __future__ import absolute_import

import re
import six
import logging
import posixpath

from collections import namedtuple
from symbolic import parse_addr

from sentry.interfaces.contexts import DeviceContextType
from sentry.reprocessing import report_processing_issue
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


def handle_symbolication_failed(e, data, errors=None):
    # User fixable but fatal errors are reported as processing
    # issues
    if e.is_user_fixable and e.is_fatal:
        report_processing_issue(
            data,
            scope='native',
            object='dsym:%s' % e.image_uuid,
            type=e.type,
            data=e.get_data()
        )

    # This in many ways currently does not really do anything.
    # The reason is that once a processing issue is reported
    # the event will only be stored as a raw event and no
    # group will be generated.  As a result it also means that
    # we will not have any user facing event or error showing
    # up at all.  We want to keep this here though in case we
    # do not want to report some processing issues (eg:
    # optional difs)
    if e.is_user_fixable or e.is_sdk_failure:
        if errors is None:
            errors = data.setdefault('errors', [])
        errors.append(e.get_data())
    else:
        logger.debug('Failed to symbolicate with native backend',
                     exc_info=True)
