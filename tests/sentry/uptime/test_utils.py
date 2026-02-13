from sentry.uptime.utils import (
    build_backlog_key,
    build_backlog_task_scheduled_key,
    generate_scheduled_check_times_ms,
)


class TestGenerateScheduledCheckTimesMs:
    def test_forward_single(self):
        assert generate_scheduled_check_times_ms(1000, 60000, 1) == [1000]

    def test_forward_multiple(self):
        assert generate_scheduled_check_times_ms(1000, 60000, 3) == [1000, 61000, 121000]

    def test_backward_single(self):
        assert generate_scheduled_check_times_ms(1000, 60000, 1, forward=False) == [1000]

    def test_backward_multiple(self):
        assert generate_scheduled_check_times_ms(121000, 60000, 3, forward=False) == [
            1000,
            61000,
            121000,
        ]

    def test_forward_is_default(self):
        assert generate_scheduled_check_times_ms(
            1000, 60000, 3
        ) == generate_scheduled_check_times_ms(1000, 60000, 3, forward=True)


class TestBuildBacklogKey:
    def test_formats_correctly(self):
        assert build_backlog_key("123") == "uptime:backlog:123"
        assert build_backlog_key("abc-def") == "uptime:backlog:abc-def"


class TestBuildBacklogTaskFlagKey:
    def test_formats_correctly(self):
        assert build_backlog_task_scheduled_key("123") == "uptime:backlog_task_scheduled:123"
        assert (
            build_backlog_task_scheduled_key("abc-def") == "uptime:backlog_task_scheduled:abc-def"
        )
