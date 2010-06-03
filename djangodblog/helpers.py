from django.utils.hashcompat import md5_constructor
from django.views.debug import ExceptionReporter

class ImprovedExceptionReporter(ExceptionReporter):
    def __init__(self, request, exc_type, exc_value, frames):
        ExceptionReporter.__init__(self, request, exc_type, exc_value, None)
        self.frames = frames

    def get_traceback_frames(self):
        return self.frames

def construct_checksum(error):
    checksum = md5_constructor(str(error.level))
    checksum.update(error.class_name or '')
    message = error.traceback or error.message
    if isinstance(message, unicode):
        message = message.encode('utf-8', 'replace')
    checksum.update(message)
    return checksum.hexdigest()