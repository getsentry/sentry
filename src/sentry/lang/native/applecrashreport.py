from __future__ import absolute_import

from sentry.utils.compat import implements_to_string
from sentry.utils.native import parse_addr

REPORT_VERSION = '104'


@implements_to_string
class AppleCrashReport(object):

    def __init__(self, threads=None, context=None, debug_images=None,
            symbolicated=False, exception=None):
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
        return "OS Version: {} {} ({})\nReport Version: {}".format(
            self.context.get('os').get('name'),
            self.context.get('os').get('version'),
            self.context.get('os').get('build'),
            REPORT_VERSION
        )

    def _get_exception_info(self):
        rv = []
        if self.exception and self.exception[0]:
            # We only have one exception at a time
            exception = self.exception[0]
            signal = ""
            if (exception
                .get('mechanism')
                .get('posix_signal')
                .get('name')
               ):
                signal = ' ({})'.format(
                    exception
                    .get('mechanism')
                    .get('posix_signal')
                    .get('name')
                )

            name = ""
            if (exception
                .get('mechanism')
                .get('mach_exception')
                .get('exception_name')
               ):
                name = '{}'.format(
                    exception
                    .get('mechanism')
                    .get('mach_exception')
                    .get('exception_name')
                )

            if name or signal:
                rv.append('Exception Type: {}{}'.format(
                    name,
                    signal
                ))

            exc_name = ""
            if (exception
                .get('mechanism')
                .get('posix_signal')
                .get('code_name')
               ):
                exc_name = '{}'.format(
                    exception
                    .get('mechanism')
                    .get('posix_signal')
                    .get('code_name')
                )

            exc_addr = ""
            if (exception
                .get('mechanism')
                .get('relevant_address')
               ):
                exc_addr = ' at {}'.format(
                    exception
                    .get('mechanism')
                    .get('relevant_address')
                )

            if exc_name and exc_addr:
                rv.append('Exception Codes: {}{}'.format(
                    exc_name,
                    exc_addr
                ))

            if exception.get('thread_id') is not None:
                rv.append('Crashed Thread: {}'.format(
                    exception.get('thread_id')
                ))

            if exception.get('value'):
                rv.append('\nApplication Specific Information:\n{}'.format(
                    exception.get('value')
                ))

        return "\n".join(rv)

    def get_threads_apple_string(self):
        rv = []
        for thread in self.threads:
            thread_string = self.get_thread_apple_string(thread)
            if thread_string is not None:
                rv.append(thread_string)
        return "\n\n".join(rv)

    def get_thread_apple_string(self, thread):
        rv = []
        stacktrace = thread.get('stacktrace')
        if stacktrace is None:
            return None
        if stacktrace:
            frames = stacktrace.get('frames')
            if frames:
                i = 0
                for frame in reversed(frames):
                    frame_string = self._convert_frame_to_apple_string(
                        frame=frame,
                        number=i
                    )
                    if frame_string is not None:
                        rv.append(frame_string)
                        i += 1

        if len(rv) == 0:
            return None  # No frames in thread, so we remove thread
        thread_string = 'Thread {} name: {}\n'.format(thread['id'],
            thread['name'] and thread['name'] or ''
        )
        if thread['crashed']:
            thread_string += 'Thread {} Crashed:\n'.format(thread['id'])
        return thread_string + "\n".join(rv)

    def _convert_frame_to_apple_string(self, frame, number=0):
        if frame.get('instruction_addr') is None:
            return None
        slide_value = self._get_slide_value(frame['image_addr'])
        instruction_addr = slide_value + parse_addr(frame['instruction_addr'])
        image_addr = slide_value + parse_addr(frame['image_addr'])
        offset = ''
        if frame['image_addr'] is not None and not self.symbolicated:
            offset = ' + {}'.format(
                instruction_addr - slide_value - parse_addr(frame['symbol_addr'])
            )
        symbol = hex(image_addr)
        if self.symbolicated:
            file = ''
            if frame.get('filename') and frame.get('lineno'):
                file = " ({}:{})".format(
                    frame['filename'],
                    frame['lineno']
                )
            symbol = "{}{}".format(
                frame['function'],
                file
            )
        return "{}{}{}{}{}".format(
            str(number).ljust(4, " "),
            frame['package'].rsplit('/', 1)[-1].ljust(32, " "),
            hex(instruction_addr).ljust(20, " "),
            symbol,
            offset
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
        binary_images = map(lambda i:
            self._convert_debug_meta_to_binary_image_row(debug_image=i),
            sorted(self.debug_images, key=lambda i: parse_addr(i['image_addr'])
        ))
        return "Binary Images:\n" + "\n".join(binary_images)

    def _convert_debug_meta_to_binary_image_row(self, debug_image):
        slide_value = parse_addr(debug_image['image_vmaddr'])
        image_addr = parse_addr(debug_image['image_addr']) + slide_value
        return "{} - {} {} {}  <{}> {}".format(
            hex(image_addr),
            hex(image_addr + debug_image['image_size'] - 1),
            debug_image['name'].rsplit('/', 1)[-1],
            self.context['device']['arch'],
            debug_image['uuid'].replace('-', '').lower(),
            debug_image['name']
        )
