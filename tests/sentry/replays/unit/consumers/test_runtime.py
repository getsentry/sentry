from sentry.replays.consumers.buffered.platform import Join, Nothing, Poll, RunTime
from tests.sentry.replays.unit.consumers.test_helpers import MockNextStep


def counter_runtime() -> RunTime[int, str, None, None]:
    def init(_):
        return (22, None)

    def process(_model, message):
        if message == b"incr":
            return "incr"
        elif message == b"decr":
            return "decr"
        else:
            return "nothing"

    def update(model, msg):
        if msg == "incr":
            return (model + 1, Nothing())
        elif msg == "decr":
            return (model - 1, Nothing())
        elif msg == "join":
            return (-10, Nothing())
        elif msg == "poll":
            return (99, Nothing())
        elif msg == "nothing":
            return (model, Nothing())
        else:
            raise ValueError("Unknown msg")

    def subscription(_):
        return [
            Join(msg=lambda: "join"),
            Poll(msg=lambda: "poll"),
        ]

    return RunTime(
        init=init,
        process=process,
        update=update,
        subscription=subscription,
    )


def test_runtime_setup():
    runtime = counter_runtime()
    runtime.setup(None, next_step=MockNextStep())
    assert runtime.model == 22


def test_runtime_submit():
    # RunTime defaults to a start point of 22.
    runtime = counter_runtime()
    runtime.setup(None, next_step=MockNextStep())
    assert runtime.model == 22

    # Two incr commands increase the count by 2.
    runtime.submit(b"incr")
    runtime.submit(b"incr")
    assert runtime.model == 24

    # Four decr commands decrease the count by 4.
    runtime.submit(b"decr")
    runtime.submit(b"decr")
    runtime.submit(b"decr")
    runtime.submit(b"decr")
    assert runtime.model == 20

    # Messages which the application does not understand do nothing to the model.
    runtime.submit(b"other")
    assert runtime.model == 20


def test_runtime_publish():
    # RunTime defaults to a start point of 22.
    runtime = counter_runtime()
    runtime.setup(None, next_step=MockNextStep())
    assert runtime.model == 22

    # A join event updates the model and sets it to -10.
    runtime.publish("join")
    assert runtime.model == -10

    # A poll event updates the model and sets it to 99.
    runtime.publish("poll")
    assert runtime.model == 99
