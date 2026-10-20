from sentry.seer.autofix.pr_iteration.errors import PrIterationError, raised_pr_iteration_error


def test_raised_error_has_a_traceback() -> None:
    error = raised_pr_iteration_error("boom")

    assert isinstance(error, PrIterationError)
    assert str(error) == "boom"
    assert error.__traceback__ is not None


def test_raised_error_does_not_chain_the_handled_exception() -> None:
    try:
        raise ValueError("handled")
    except ValueError:
        error = raised_pr_iteration_error("boom")

    assert error.__suppress_context__ is True
    assert error.__cause__ is None
