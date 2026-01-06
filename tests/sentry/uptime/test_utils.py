from sentry.uptime.utils import build_backlog_key, build_backlog_task_flag_key


class TestBuildBacklogKey:
    def test_formats_correctly(self):
        assert build_backlog_key("123") == "uptime:backlog:123"
        assert build_backlog_key("abc-def") == "uptime:backlog:abc-def"


class TestBuildBacklogTaskFlagKey:
    def test_formats_correctly(self):
        assert build_backlog_task_flag_key("123") == "uptime:backlog_task:123"
        assert build_backlog_task_flag_key("abc-def") == "uptime:backlog_task:abc-def"
