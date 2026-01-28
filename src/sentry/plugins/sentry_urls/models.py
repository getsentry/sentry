import sentry
from sentry.constants import MAX_TAG_VALUE_LENGTH
from sentry.plugins.bases.tag import TagPlugin


class UrlsPlugin(TagPlugin):
    """
    Automatically adds the 'url' tag from events containing interface data
    from ``request``.
    """

    slug = "urls"
    title = "Auto Tag: URLs"
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    tag = "url"
    project_default_enabled = True

    def get_tag_values(self, event) -> list[str]:
        http = event.interfaces.get("request")
        if not http:
            return []
        if not http.url:
            return []
        url = http.url
        if len(url) > MAX_TAG_VALUE_LENGTH:
            url = url[: MAX_TAG_VALUE_LENGTH - 3] + "..."
        return [url]
