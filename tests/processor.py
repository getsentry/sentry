
from sentry.processors import BaseProcessor

CALLED = 0


class TestProcessor(BaseProcessor):
    def post_processing(self, event):
        global CALLED
        CALLED += 1
