import textwrap

from sentry.tasks.seer.night_shift.event_formatter import format_event_output


def test_error_event_comprehensive() -> None:
    # One realistic Python error event exercising the main path: exception with
    # stacktrace + enhanced frame (context + locals), HTTP request, user with
    # geo dedup, tags, contexts. Truncation of a long string local pins the
    # variable-value cap.
    event = {
        "platform": "python",
        "entries": [
            {
                "type": "exception",
                "data": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "bad input",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "filename": "src/app.py",
                                        "function": "do_thing",
                                        "lineNo": 10,
                                        "inApp": True,
                                        "context": [
                                            (9, "def do_thing():"),
                                            (10, "    raise ValueError('bad input')"),
                                            (11, "    return 1"),
                                        ],
                                        "vars": {
                                            "x": "broken",
                                            "long_str": "a" * 200,
                                        },
                                    }
                                ],
                            },
                        }
                    ],
                },
            },
            {"type": "request", "data": {"method": "POST", "url": "https://api.example.com/x"}},
        ],
        "user": {
            "email": "alice@example.com",
            "geo": {"country_code": "US", "city": "NYC", "region": "US"},
        },
        "tags": [{"key": "env", "value": "prod"}],
        "contexts": {"runtime": {"name": "CPython", "version": "3.12.0"}},
    }

    output = format_event_output(event)

    expected_frame_block = (
        textwrap.dedent(
            """
        **Most Relevant Frame:**
        ─────────────────────
          File "src/app.py", line 10, in do_thing

             9 │ def do_thing():
          → 10 │     raise ValueError('bad input')
            11 │     return 1

        Local Variables:
        ├─ x: "broken"
        └─ long_str: "{long_a}..."
        """
        )
        .strip()
        .format(long_a="a" * 75)
    )
    assert expected_frame_block in output

    expected_request_block = textwrap.dedent(
        """
        ### HTTP Request

        **Method:** POST
        **URL:** https://api.example.com/x
        """
    ).strip()
    assert expected_request_block in output

    # User block — `geo` dedupes "US" appearing in both country_code and region.
    expected_user_block = textwrap.dedent(
        """
        ### User

        **user**: email:alice@example.com
        **user.geo**: US, NYC
        """
    ).strip()
    assert expected_user_block in output

    expected_tags_block = textwrap.dedent(
        """
        ### Tags

        **env**: prod
        """
    ).strip()
    assert expected_tags_block in output

    expected_contexts_block = textwrap.dedent(
        """
        ### Additional Context

        These are additional context provided by the user when they're instrumenting their application.

        **runtime**
        name: "CPython"
        version: "3.12.0"
        """
    ).strip()
    assert expected_contexts_block in output

    assert "### Error" in output
    assert "ValueError: bad input" in output
    assert "**Full Stacktrace:**" in output


def test_chained_exceptions_rendered_outer_first() -> None:
    # Sentry stores exceptions innermost-first; the formatter reverses so the
    # rethrown/outer exception renders first, then "Caused by:" for the inner.
    event = {
        "platform": "python",
        "entries": [
            {
                "type": "exception",
                "data": {
                    "values": [
                        {
                            "type": "KeyError",
                            "value": "'missing'",
                            "stacktrace": {"frames": [{"filename": "a.py", "function": "f"}]},
                        },
                        {
                            "type": "RuntimeError",
                            "value": "wrapper failed",
                            "stacktrace": {"frames": [{"filename": "b.py", "function": "g"}]},
                        },
                    ],
                },
            }
        ],
    }

    output = format_event_output(event)

    error_idx = output.index("### Error")
    caused_by_idx = output.index("**Caused by:**")
    inner_header_idx = output.index("### KeyError: 'missing'")
    assert error_idx < caused_by_idx < inner_header_idx
    assert "RuntimeError: wrapper failed" in output


def test_alt_interfaces_threads_message_and_csp() -> None:
    # Threads, message, and CSP each drive an independent code path. They don't
    # normally coexist in a real event, but they don't conflict in the
    # formatter either, so we exercise all three in one fixture.
    event = {
        "platform": "javascript",
        "entries": [
            {"type": "message", "data": {"formatted": "something went wrong"}},
            {
                "type": "threads",
                "data": {
                    "values": [
                        {
                            "crashed": True,
                            "name": "main",
                            "stacktrace": {"frames": [{"filename": "x.js", "function": "crash"}]},
                        }
                    ],
                },
            },
            {
                "type": "csp",
                "data": {
                    "blocked_uri": "https://evil.example.com/a.js",
                    "violated_directive": "script-src",
                    "document_uri": "https://app.example.com/",
                },
            },
        ],
    }

    output = format_event_output(event)

    expected_csp_block = textwrap.dedent(
        """
        ### CSP Violation

        **Blocked URI**: https://evil.example.com/a.js
        **Violated Directive**: script-src
        **Document URI**: https://app.example.com/
        """
    ).strip()
    assert expected_csp_block in output

    assert "something went wrong" in output
    assert "**Thread** (main)" in output
    assert "crash" in output
