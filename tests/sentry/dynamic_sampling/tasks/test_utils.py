from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.tasks.sliding_window_org import sliding_window_org
from sentry.dynamic_sampling.tasks.task_context import TaskContext


@pytest.mark.django_db
@patch("sentry.dynamic_sampling.tasks.sliding_window_org.TimedIterator")
def test_context_injection_with_decorator(timed_iterator):
    sliding_window_org()

    assert timed_iterator.call_args[0][0] == TaskContext(
        name="sentry.tasks.dynamic_sampling.sliding_window_org", num_seconds=420
    )
