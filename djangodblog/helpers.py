from django.views.debug import ExceptionReporter

class ImprovedExceptionReporter(ExceptionReporter):
    def __init__(self, request, exc_type, exc_value, frames):
        ExceptionReporter.__init__(self, request, exc_type, exc_value, None)
        self.frames = frames

    def get_traceback_frames(self):
        return self.frames