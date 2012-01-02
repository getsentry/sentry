
from sentry.processors import BaseProcessor


class TestProcessor(BaseProcessor):

    def __init__(self, *args, **kwargs):
        self.called = 0

    def post_processing(self, event):
        self.called += 1
