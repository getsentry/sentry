from sentry.uptime.utils import build_backlog_key, build_backlog_task_scheduled_key


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
