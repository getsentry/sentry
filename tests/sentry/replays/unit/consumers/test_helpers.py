from sentry.replays.consumers.buffered.platform import Flags, Model, Msg, Output, RunTime


class MockRunTime(RunTime[Model, Msg, Flags, Output]):
    def _handle_msg(self, msg):
        while True:
            model, cmd = self.update(self.model, msg)
            self._model = model
            msg = yield cmd

    def submit(self, message):
        yield from self._handle_msg(self.process(self.model, message))


class MockNextStep:
    def __init__(self):
        self.values = []

    def __call__(self, value):
        self.values.append(value)


class MockSink:
    def __init__(self):
        self.accepted = []

    def accept(self, buffer):
        self.accepted.extend(buffer)
