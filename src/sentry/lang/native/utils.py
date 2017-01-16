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
    relevant stacktraces in a list.
    """
    rv = []

    exc_container = data.get('sentry.interfaces.Exception')
    if exc_container:
        for exc in exc_container['values']:
            stacktrace = exc.get('stacktrace')
            if stacktrace:
                rv.append((stacktrace, exc))

    stacktrace = data.get('sentry.interfaces.Stacktrace')
    if stacktrace:
        rv.append((stacktrace, None))

    threads = data.get('threads')
    if threads:
        for thread in threads['values']:
            stacktrace = thread.get('stacktrace')
            if stacktrace:
                rv.append((stacktrace, thread))

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


def get_apple_crash_report(threads, context, debug_images):
    rv = []
    # TODO(hazat): get real header
    rv.append(_get_meta_header())
    rv.append(get_threads_apple_string(threads))
    rv.append(get_binary_images_apple_string(debug_images, context))
    return ''.join(rv) + '\n\nEOF'


def _get_meta_header():
    return 'OS Version:          iPhone OS 10.2 (14C92)\n\
Report Version:      104\n\n'


def get_threads_apple_string(threads):
    rv = []
    for thread in threads:
        rv.append(get_thread_apple_string(thread))
    return "\n\n".join(rv)


def get_thread_apple_string(thread):
    rv = []
    stacktrace = thread.get('stacktrace')
    if stacktrace is None:
        return ''
    if stacktrace:
        frames = stacktrace.get('frames')
        if frames:
            i = 0
            for frame in reversed(frames):
                rv.append(_convert_frame_to_apple_string(frame, i))
                i += 1
    thread_string = 'Thread {} name: {}\n'.format(thread['id'],
        thread['name'] and thread['name'] or ''
    )
    if thread['crashed']:
        thread_string += 'Thread {} Crashed:\n'.format(thread['id'])
    return thread_string + "\n".join(rv)


def _convert_frame_to_apple_string(frame, number=0, symbolicated=False):
    slide_value = _get_slide_value()
    instruction_addr = slide_value + int(frame['instruction_addr'], 16)
    image_addr = slide_value + int(frame['image_addr'], 16)
    offset = ''
    if frame['image_addr'] is not None and not symbolicated:
        offset = ' + {}'.format(
            instruction_addr - slide_value - int(frame['symbol_addr'], 16)
        )

    return "{} {} {} {}{}".format(number,
        frame['package'].rsplit('/', 1)[-1],
        hex(instruction_addr),
        (symbolicated and frame['function'] or hex(image_addr)),
        offset
    )


def _get_slide_value():
    # TODO(hazat): this value is for 64bit devices (slide value)
    # 0x0000000100000000 need to find out how to get it
    return 0
    return int('0x0000000100000000', 16)


def get_binary_images_apple_string(debug_images, contexts):
    binary_images = map(lambda i:
        _convert_debug_meta_to_binary_image_row(i, contexts),
        sorted(debug_images, key=lambda i: int(i['image_addr'], 16)
    ))
    return "Binary Images:\n" + "\n".join(binary_images)


def _convert_debug_meta_to_binary_image_row(debug_image, contexts):
    slide_value = _get_slide_value()
    image_addr = int(debug_image['image_addr'], 16) + slide_value
    return "{} - {} {} {}  <{}> {}".format(
        hex(image_addr),
        hex(image_addr + debug_image['image_size'] - 1),
        debug_image['name'].rsplit('/', 1)[-1],
        contexts['device']['arch'],
        debug_image['uuid'].replace('-', '').lower(),
        debug_image['name']
    )
