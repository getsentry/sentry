from sentry.processors import Processor


class TestProcessor(Processor):

    def __init__(self, *args, **kwargs):
        self.called = 0

    def post_processing(self, event):
        self.called += 1
