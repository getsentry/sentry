from __future__ import absolute_import

from sentry.event_manager import md5_from_hash
from sentry.interfaces.stacktrace import (
    is_caused_by, is_unhashable_function, is_unhashable_module, is_url, remove_function_outliers,
    remove_filename_outliers, remove_module_outliers
)


def is_invalid_stack(frames):
    if len(frames) != 1:
        return False

    frame = frames[0]
    abs_path = frame.get('abs_path', '')
    return not frame.get('function') and (abs_path.startswith('blob:') or is_url(abs_path))


def get_frame_hash(platform, frame):
    output = []
    # Safari throws [native code] frames in for calls like ``forEach``
    # whereas Chrome ignores these. Let's remove it from the hashing algo
    # so that they're more likely to group together
    if frame.get('filename') == '[native code]':
        return output

    if frame.get('module'):
        if is_unhashable_module(frame['module']):
            output.append('<module>')
        else:
            output.append(remove_module_outliers(frame['module']))
    elif frame.get('filename'
                   ) and not is_url(frame['filename']) and not is_caused_by(frame['filename']):
        output.append(remove_filename_outliers(frame['filename'], platform))

    context_line = frame.get('context_line')
    abs_path = frame.get('abs_path', '')
    if context_line is None:
        can_use_context = False
    elif len(context_line) > 120:
        can_use_context = False
    elif abs_path.startswith('blob:') or is_url(abs_path) and not frame['function']:
        # the context is too risky to use here as it could be something
        # coming from an HTML page or it could be minified/unparseable
        # code, so lets defer to other lesser heuristics (like lineno)
        can_use_context = False
    else:
        can_use_context = True

    if can_use_context:
        output.append(context_line)
    elif not output:
        # If we were unable to achieve any context at this point
        # (likely due to a bad JavaScript error) we should just
        # bail on recording this frame
        return output
    elif frame.get('symbol'):
        output.append(frame.get('symbol'))
    elif frame.get('function'):
        if is_unhashable_function(frame['function']):
            output.append('<function>')
        else:
            output.append(remove_function_outliers(frame['function']))
    elif frame.get('lineno') is not None and frame.get('colno') is not None:
        output.extend([frame['lineno'], frame['colno']])
    return output


def get_stacktrace_hash(platform, stacktrace):
    frames = stacktrace['frames']

    stack_invalid = is_invalid_stack(frames)
    if stack_invalid:
        return []

    output = []
    for frame in frames:
        output.extend(get_frame_hash(platform, frame))

    return output


def get_exception_hash(platform, exception):
    output = []
    for value in exception['values']:
        if not value['stacktrace']:
            continue
        stack_hash = get_stacktrace_hash(platform, value['stacktrace'])
        if stack_hash:
            output.extend(stack_hash)
            output.append(value.get('type'))

    if not output:
        for value in exception['values']:
            output.extend([v for v in [value.get('type'), value.get('value')] if v])

    return output


def get_preprocess_defaults(data):
    stacktrace = data.get('sentry.interfaces.Stacktrace')
    exception = data.get('sentry.interfaces.Exception')
    template = data.get('sentry.interfaces.Template')

    output = []

    if exception is not None:
        result = get_exception_hash(data['platform'], exception)
        if result:
            output.append(result)

    if stacktrace is not None and not output:
        result = get_stacktrace_hash(data['platform'], stacktrace)
        if result:
            output.append(result)

    if template is not None and not output:
        # i think data should be validated at this point?
        output.append([template['filename'], template['context_line']])

    if not output and data.get('message'):
        output = [data['message']]

    return output


def get_preprocess_hashes(data):
    from sentry.coreapi import LazyData
    if isinstance(data, LazyData):
        data = dict(data.items())

    fingerprint = data.get('fingerprint')
    checksum = data.get('checksum')
    output = get_preprocess_defaults(data)

    if fingerprint:
        default_values = set(['{{ default }}', '{{default}}'])
        if any(d in fingerprint for d in default_values):
            hash_count = len(output)
        else:
            hash_count = 1

        hashes = []
        for idx in range(hash_count):
            result = []
            for bit in fingerprint:
                if bit in default_values:
                    result.extend(output[idx])
                else:
                    result.append(bit)
            hashes.append(md5_from_hash(result))
    elif checksum:
        hashes = [checksum]
    else:
        hashes = [md5_from_hash(h) for h in output]

    return hashes
