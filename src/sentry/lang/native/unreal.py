from __future__ import absolute_import
from symbolic import Unreal4Crash
from sentry.lang.native.minidump import MINIDUMP_ATTACHMENT_TYPE
from sentry.models import UserReport
from sentry.utils.safe import set_path, setdefault_path

import re
import uuid

_portable_callstack_regexp = re.compile(
    r'((?P<package>[\w]+) )?(?P<baseaddr>0x[\da-fA-F]+) \+ (?P<offset>[\da-fA-F]+)')


def process_unreal_crash(data):
    """Processes the raw bytes of the unreal crash"""
    return Unreal4Crash.from_bytes(data)


def unreal_attachment_type(unreal_file):
    """Returns the `attachment_type` for the
    unreal file type or None if not recognized"""
    if unreal_file.type == "minidump":
        return MINIDUMP_ATTACHMENT_TYPE


def merge_unreal_context_event(unreal_context, event, project):
    """Merges the context from an Unreal Engine 4 crash
    with the given event."""
    runtime_prop = unreal_context.get('runtime_properties')
    if runtime_prop is None:
        return

    message = runtime_prop.pop('error_message', None)
    if message is not None:
        event['message'] = message

    username = runtime_prop.pop('username', None)
    if username is not None:
        set_path(event, 'user', 'username', value=username)

    memory_physical = runtime_prop.pop('memory_stats_total_physical', None)
    if memory_physical is not None:
        set_path(event, 'contexts', 'device', 'memory_size', value=memory_physical)

    # Likely overwritten by minidump processing
    os_major = runtime_prop.pop('misc_os_version_major', None)
    if os_major is not None:  # i.e: Windows 10
        set_path(event, 'contexts', 'os', 'name', value=os_major)

    gpu_brand = runtime_prop.pop('misc_primary_cpu_brand', None)
    if gpu_brand is not None:
        set_path(event, 'contexts', 'gpu', 'name', value=gpu_brand)

    user_desc = runtime_prop.pop('user_description', None)
    if user_desc is not None:
        event_id = event.setdefault('event_id', uuid.uuid4().hex)
        feedback_user = 'unknown'
        if username is not None:
            feedback_user = username

        UserReport.objects.create(
            project=project,
            event_id=event_id,
            name=feedback_user,
            email='',
            comments=user_desc,
        )

    portable_callstack = runtime_prop.pop('portable_call_stack', None)
    if portable_callstack is not None:
        frames = []

        for match in _portable_callstack_regexp.finditer(portable_callstack):
            baseaddr = int(match.group('baseaddr'), 16)
            offset = int(match.group('offset'), 16)
            # Crashes without PDB in the client report: 0x00000000ffffffff + ffffffff
            if baseaddr == 0xffffffff and offset == 0xffffffff:
                continue

            frames.append({
                'package': match.group('package'),
                'instruction_addr': hex(baseaddr + offset),
            })

            frames.reverse()

        if len(frames) > 0:
            event['stacktrace'] = {
                'frames': frames
            }

    # drop modules. minidump processing adds 'images loaded'
    runtime_prop.pop('modules', None)

    # add everything else as extra
    extra = event.setdefault('extra', {})
    extra.update(**runtime_prop)

    # add sdk info
    event['sdk'] = {
        'name': 'sentry.unreal.crashreporter',
        'version': runtime_prop.pop('crash_reporter_client_version', '0.0.0')
    }


def merge_unreal_logs_event(unreal_logs, event):
    setdefault_path(event, 'breadcrumbs', 'values', value=[])
    breadcrumbs = event['breadcrumbs']['values']

    for log in unreal_logs:
        breadcrumbs.append({
            'timestamp': log.get('timestamp'),
            'category': log.get('component'),
            'message': log.get('message'),
        })
