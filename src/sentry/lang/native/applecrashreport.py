from __future__ import absolute_import

import posixpath

from sentry.utils.compat import implements_to_string
from sentry.utils.native import parse_addr
from sentry.constants import NATIVE_UNKNOWN_STRING

REPORT_VERSION = '104'


@implements_to_string
class AppleCrashReport(object):
    def __init__(
        self, threads=None, context=None, debug_images=None, symbolicated=False, exception=None
    ):
        self.threads = threads
        self.context = context
        self.debug_images = debug_images
        self.symbolicated = symbolicated
        self.exception = exception

    def __str__(self):
        rv = []
        rv.append(self._get_meta_header())
        rv.append(self._get_exception_info())
        rv.append(self.get_threads_apple_string())
        rv.append(self.get_binary_images_apple_string())
        return '\n\n'.join(rv) + '\n\nEOF'

    def _get_meta_header(self):
        return 'OS Version: %s %s (%s)\nReport Version: %s' % (
            self.context.get('os').get('name'), self.context.get('os').get('version'),
            self.context.get('os').get('build'), REPORT_VERSION
        )

    def _get_exception_info(self):
        rv = []
        if self.exception and self.exception[0]:
            # We only have one exception at a time
            exception = self.exception[0] or {}
            mechanism = exception.get('mechanism') or {}

            signal = (mechanism.get('posix_signal') or {}).get('name')
            name = (mechanism.get('mach_exception') or {}).get('exception_name')

            if name or signal:
                rv.append(
                    'Exception Type: %s%s' %
                    (name or 'Unknown', signal and (' (%s)' % signal) or '', )
                )

            exc_name = (mechanism.get('posix_signal') or {}).get('code_name')
            exc_addr = mechanism.get('relevant_address')
            if exc_name:
                rv.append(
                    'Exception Codes: %s%s' %
                    (exc_name, exc_addr is not None and (' at %s' % exc_addr) or '', )
                )

            if exception.get('thread_id') is not None:
                rv.append('Crashed Thread: %s' % exception['thread_id'])

            if exception.get('value'):
                rv.append('\nApplication Specific Information:\n%s' % exception['value'])

        return '\n'.join(rv)

    def get_threads_apple_string(self):
        rv = []
        for thread in self.threads or []:
            thread_string = self.get_thread_apple_string(thread)
            if thread_string is not None:
                rv.append(thread_string)
        return '\n\n'.join(rv)

    def get_thread_apple_string(self, thread):
        rv = []
        stacktrace = thread.get('stacktrace')
        if stacktrace is None:
            return None
        if stacktrace:
            frames = stacktrace.get('frames')
            if frames:
                for i, frame in enumerate(reversed(frames)):
                    frame_string = self._convert_frame_to_apple_string(
                        frame=frame,
                        next=frames[len(frames) - i - 2] if i < len(frames) - 1 else None,
                        number=i
                    )
                    if frame_string is not None:
                        rv.append(frame_string)

        if len(rv) == 0:
            return None  # No frames in thread, so we remove thread
        thread_string = 'Thread %s name: %s\n' % (
            thread['id'], thread.get('name') and thread['name'] or ''
        )
        if thread.get('crashed'):
            thread_string += 'Thread %s Crashed:\n' % thread['id']
        return thread_string + '\n'.join(rv)

    def _convert_frame_to_apple_string(self, frame, next=None, number=0):
        if frame.get('instruction_addr') is None:
            return None
        slide_value = self._get_slide_value(frame.get('image_addr'))
        instruction_addr = slide_value + parse_addr(frame.get('instruction_addr'))
        image_addr = slide_value + parse_addr(frame.get('image_addr'))
        offset = ''
        if frame.get('image_addr') is not None and \
           (not self.symbolicated or (
                frame.get('function') or NATIVE_UNKNOWN_STRING) == NATIVE_UNKNOWN_STRING):
            offset = ' + %s' % (
                instruction_addr - slide_value - parse_addr(frame.get('symbol_addr'))
            )
        symbol = hex(image_addr)
        if self.symbolicated:
            file = ''
            if frame.get('filename') and frame.get('lineno'):
                file = ' (%s:%s)' % (
                    posixpath.basename(frame.get('filename') or NATIVE_UNKNOWN_STRING),
                    frame['lineno']
                )
            symbol = '%s%s' % (frame.get('function') or NATIVE_UNKNOWN_STRING, file)
            if next and parse_addr(frame['instruction_addr']) == \
               parse_addr(next['instruction_addr']):
                symbol = '[inlined] ' + symbol
        return '%s%s%s%s%s' % (
            str(number).ljust(4, ' '),
            (frame.get('package') or NATIVE_UNKNOWN_STRING).rsplit('/', 1)[-1].ljust(32, ' '),
            hex(instruction_addr).ljust(20, ' '), symbol, offset
        )

    def _get_slide_value(self, image_addr):
        if self.debug_images:
            for debug_image in self.debug_images:
                if parse_addr(debug_image['image_addr']) == parse_addr(image_addr):
                    return parse_addr(debug_image['image_vmaddr'])
        return 0

    def get_binary_images_apple_string(self):
        # We dont need binary images on symbolicated crashreport
        if self.symbolicated or self.debug_images is None:
            return ''
        binary_images = map(
            lambda i: self._convert_debug_meta_to_binary_image_row(debug_image=i),
            sorted(self.debug_images, key=lambda i: parse_addr(i['image_addr']))
        )
        return 'Binary Images:\n' + '\n'.join(binary_images)

    def _convert_debug_meta_to_binary_image_row(self, debug_image):
        slide_value = parse_addr(debug_image['image_vmaddr'])
        image_addr = parse_addr(debug_image['image_addr']) + slide_value
        return '%s - %s %s %s  <%s> %s' % (
            hex(image_addr), hex(image_addr + debug_image['image_size'] - 1),
            debug_image['name'].rsplit('/', 1)[-1], self.context['device']['arch'],
            debug_image['uuid'].replace('-', '').lower(), debug_image['name']
        )
