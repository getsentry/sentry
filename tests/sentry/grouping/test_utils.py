from sentry.grouping.utils import call_single_element, call_many_elements


def test_call_single_element():
    def get_x():
        return "x"

    def foo2():
        for x in call_many_elements(foo3):
            yield x + call_single_element(get_x)

    def foo3():
        yield "a"
        yield "b"

    def bar():
        # bar does not have to understand that foo is now a generator...
        return call_single_element(foo2) * 2

    assert list(call_many_elements(bar)) == ["axax", "bxbx"]


def test_stacktrace_parametrization():
    def frame(frame_json):
        return frame_json["function"]

    def stacktrace(stacktrace_json):
        frames = list(stacktrace_json["frames"])
        while frames:
            yield {"functions": [call_single_element(frame, frame_json) for frame_json in frames]}

            frames.pop()

    def exception(exception_json):
        return {"stacktrace": call_single_element(stacktrace, exception_json["stacktrace"])}

    def event(event_json):
        return {
            "exceptions": [
                call_single_element(exception, exception_json)
                for exception_json in event_json["exceptions"]
            ]
        }

    output = list(
        call_many_elements(
            event,
            {
                "exceptions": [
                    {
                        "stacktrace": {
                            "frames": [
                                {"function": "foo"},
                                {"function": "bar"},
                                {"function": "baz"},
                            ]
                        }
                    },
                    {
                        "stacktrace": {
                            "frames": [
                                {"function": "xoo"},
                                {"function": "xar"},
                                {"function": "xaz"},
                            ]
                        }
                    },
                ]
            },
        )
    )

    assert output == [
        {
            "exceptions": [
                {"stacktrace": {"functions": ["foo", "bar", "baz"]}},
                {"stacktrace": {"functions": ["xoo", "xar", "xaz"]}},
            ]
        },
        {
            "exceptions": [
                {"stacktrace": {"functions": ["foo", "bar"]}},
                {"stacktrace": {"functions": ["xoo", "xar"]}},
            ]
        },
        {
            "exceptions": [
                {"stacktrace": {"functions": ["foo"]}},
                {"stacktrace": {"functions": ["xoo"]}},
            ]
        },
    ]
