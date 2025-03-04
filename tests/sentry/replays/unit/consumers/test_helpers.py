from sentry.replays.consumers.buffered.platform import Flags, Model, Msg, Output, RunTime


class SandboxRunTime(RunTime[Model, Msg, Flags, Output]):
    def _handle_msg(self, msg):
        # The first msg returned by the submit function needs to be yielded. From this point
        # onward we'll only intercept commands and we'll send msgs.
        yield msg

        while True:
            model, cmd = self.update(self.model, msg)
            self._model = model

            # The application wants the runtime to execute this command but we're intercepting it
            # and forcing the test suite to decide what msg should be produced.
            msg = yield cmd

    def submit(self, message):
        yield from self._handle_msg(self.process(self.model, message))

    def publish(self, sub_name: str):
        self._register_subscriptions()

        sub = self._subscriptions.get(sub_name)
        if sub is None:
            return None

        msg = yield sub
        yield from self._handle_msg(msg)


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
