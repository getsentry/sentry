from traceback import FrameSummary

from sentry.testutils.thread_leaks import diff


def test_get_relevant_frames_filters_thread_leak_infrastructure() -> None:
    """Regression test: get_relevant_frames should filter out thread_leaks package frames.

    When code was moved from thread_leaks.py to thread_leaks/ package, the __file__ filter
    became obsolete and only filtered diff.py, not other files like assertion.py.
    This caused production issues to show infrastructure frames instead of app code.
    """
    frames = [
        FrameSummary("./src/sentry/testutils/thread_leaks/assertion.py", 43, "patched__init__"),
        FrameSummary("./src/sentry/testutils/thread_leaks/assertion.py", 31, "_where"),
        FrameSummary("./src/sentry/some_app_code.py", 100, "business_logic"),
    ]

    filtered = diff.get_relevant_frames(frames)

    # Should filter out thread_leaks infrastructure frames, keep app code
    assert len(filtered) == 1
    assert filtered[0].filename == "./src/sentry/some_app_code.py"
    assert filtered[0].name == "business_logic"


def test_diff() -> None:
    """This bit was a bit tricky."""
    expected = [
        '<Thread(Thread-1 (worker), started daemon 123)>@module.Worker\n  File "test.py", line 10\n\n',
        '<Thread(Thread-2 (commit), started daemon 456)>@module.Committer\n  File "test.py", line 20\n\n',
    ]

    actual = [
        '<Thread(Thread-1 (worker), started daemon 123)>@module.Worker\n  File "test.py", line 10\n\n',
        '<Thread(Thread-3 (new), started daemon 789)>@module.NewWorker\n  File "test.py", line 30\n\n',
    ]

    result = diff._diff(actual, expected)

    expected_output = """\
  <Thread(Thread-1 (worker), started daemon 123)>@module.Worker
    File "test.py", line 10
  # noqa
- <Thread(Thread-3 (new), started daemon 789)>@module.NewWorker
-   File "test.py", line 30
- # noqa
+ <Thread(Thread-2 (commit), started daemon 456)>@module.Committer
+   File "test.py", line 20
+ # noqa
""".replace("# noqa", "")

    assert "".join(result) == expected_output
