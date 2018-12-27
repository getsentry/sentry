from __future__ import absolute_import

import re
import six
import logging

from collections import namedtuple
from symbolic import parse_addr, arch_from_macho, arch_is_known

from sentry.interfaces.contexts import DeviceContextType
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

# Regular expression to parse OS versions from a minidump OS string
VERSION_RE = re.compile(r'(\d+\.\d+\.\d+)\s+(.*)')

# Regular expression to guess whether we're dealing with Windows or Unix paths
WINDOWS_PATH_RE = re.compile(r'^([a-z]:\\|\\\\)', re.IGNORECASE)

AppInfo = namedtuple('AppInfo', ['id', 'version', 'build', 'name'])


def image_name(pkg):
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

    # TODO: kill this here.  we want to not support that going forward
    unique_cpu_name = None
    for img in get_path(data, 'debug_meta', 'images', filter=True, default=()):
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
