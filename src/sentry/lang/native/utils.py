from __future__ import absolute_import

import logging


logger = logging.getLogger(__name__)


APPLE_SDK_MAPPING = {
    'iPhone OS': 'iOS',
    'tvOS': 'tvOS',
    'Mac OS': 'macOS',
    'watchOS': 'watchOS',
}

KNOWN_DSYM_TYPES = {
    'iOS': 'macho',
    'tvOS': 'macho',
    'macOS': 'macho',
    'watchOS': 'macho',
}


def find_apple_crash_report_referenced_images(binary_images, threads):
    """Given some binary images from an apple crash report and a thread
    list this returns a list of image UUIDs to load.
    """
    image_map = {}
    for image in binary_images:
        image_map[image['image_addr']] = image['uuid']
    to_load = set()
    for thread in threads:
        if 'backtrace' not in thread:
            continue
        for frame in thread['backtrace']['contents']:
            img_uuid = image_map.get(frame['object_addr'])
            if img_uuid is not None:
                to_load.add(img_uuid)
    return list(to_load)


def find_stacktrace_referenced_images(debug_images, stacktraces):
    image_map = {}
    for image in debug_images:
        image_map[image['image_addr']] = image['uuid']

    to_load = set()
    for stacktrace in stacktraces:
        for frame in stacktrace['frames']:
            if 'image_addr' in frame:
                img_uuid = image_map.get(frame['image_addr'])
                if img_uuid is not None:
                    to_load.add(img_uuid)

    return list(to_load)


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


def update_stacktrace(stacktrace, new_frames, container=None,
                      store_raw=False):
    """Utility function that can update a stacktrace with new frames
    according to the reprocessing rules.  Best paired with
    `find_all_stacktraces`.
    """
    # If we have a known stacktrace container, put us to the
    # expected places
    if container is not None:
        # Update raw_stacktrace based on if we want to store stuff there.
        if store_raw:
            container['raw_stacktrace'] = {
                'frames': stacktrace['frames']
            }
        else:
            container.pop('raw_stacktrace', None)

        # We make sure the stacktrace moves to the processed slot.
        # If the input data was 'raw_stacktrace' we need to make
        # sure it now moves into 'stacktrace' as we will place a
        # new unprocessed stacktrace in that location.
        container['stacktrace'] = stacktrace

    # Put the new frames into the stacktrace object.
    stacktrace['frames'] = new_frames


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
    dsym_type = KNOWN_DSYM_TYPES.get(data['name'])
    if dsym_type is None:
        return
    try:
        system_version = tuple(int(x) for x in (
            data['version'] + '.0' * 3).split('.')[:3])
    except ValueError:
        return

    return {
        'dsym_type': 'macho',
        'sdk_name': data['name'],
        'version_major': system_version[0],
        'version_minor': system_version[1],
        'version_patchlevel': system_version[2],
    }


def get_sdk_from_apple_system_info(info):
    if not info:
        return None
    try:
        # Support newer mapping in old format.
        if info['system_name'] in KNOWN_DSYM_TYPES:
            sdk_name = info['system_name']
        else:
            sdk_name = APPLE_SDK_MAPPING[info['system_name']]
        system_version = tuple(int(x) for x in (
            info['system_version'] + '.0' * 3).split('.')[:3])
    except (ValueError, LookupError):
        return None

    return {
        'dsym_type': 'macho',
        'sdk_name': sdk_name,
        'version_major': system_version[0],
        'version_minor': system_version[1],
        'version_patchlevel': system_version[2],
    }
