import logging


logger = logging.getLogger(__name__)


APPLE_SDK_MAPPING = {
    'iPhone OS': 'iOS',
    'tvOS': 'tvOS',
    'Mac OS': 'macOS',
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
            if 'object_addr' in frame:
                img_uuid = image_map.get(frame['object_addr'])
                if img_uuid is not None:
                    to_load.add(img_uuid)

    return list(to_load)


def find_all_stacktraces(data):
    """Given a data dictionary from an event this returns all
    relevant stacktraces in a list.
    """
    rv = []

    exc_container = data.get('sentry.interfaces.Exception')
    if exc_container:
        for exc in exc_container['values']:
            stacktrace = exc.get('stacktrace')
            if stacktrace:
                rv.append(stacktrace)

    stacktrace = data.get('sentry.interfaces.Stacktrace')
    if stacktrace:
        rv.append(stacktrace)

    threads = data.get('threads')
    if threads:
        for thread in threads:
            stacktrace = thread.get('stacktrace')
            if stacktrace:
                rv.append(stacktrace)

    return rv


def get_sdk_from_apple_system_info(info):
    if not info:
        return None
    try:
        sdk_name = APPLE_SDK_MAPPING[info['system_name']]
        system_version = tuple(int(x) for x in (
            info['system_version'] + '.0' * 3).split('.')[:3])
    except LookupError:
        return None

    return {
        'dsym_type': 'macho',
        'sdk_name': sdk_name,
        'version_major': system_version[0],
        'version_minor': system_version[1],
        'version_patchlevel': system_version[2],
    }
