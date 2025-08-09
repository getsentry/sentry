from sentry.testutils.thread_leaks import diff


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
""".replace(
        "# noqa", ""
    )

    assert "".join(result) == expected_output
