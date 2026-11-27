from sentry.api.api_publish_status import ApiPublishStatus
from tools.flake8_plugin import PublishStatus


def test_plugin_publish_status_matches_api_publish_status() -> None:
    # the flake8 plugin can't import sentry, so this is what keeps its copy in sync
    api: dict[str, str] = {}
    for status in ApiPublishStatus:
        api[status.name] = status.value
    plugin: dict[str, str] = {}
    for plugin_status in PublishStatus:
        plugin[plugin_status.name] = plugin_status.value
    assert api == plugin
