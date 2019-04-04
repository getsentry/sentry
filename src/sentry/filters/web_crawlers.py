from __future__ import absolute_import

import re

from .base import Filter
from sentry.utils.data_filters import FilterStatKeys
from sentry.utils.safe import get_path

# not all of these agents are guaranteed to execute JavaScript, but to avoid
# overhead of identifying which ones do, and which ones will over time we simply
# target all of the major ones
CRAWLERS = re.compile(
    r'|'.join(
        (
            # Google spiders (Adsense and others)
            # https://support.google.com/webmasters/answer/1061943?hl=en
            r'Mediapartners\-Google',
            r'AdsBot\-Google',
            r'Googlebot',
            r'FeedFetcher\-Google',
            # Bing search
            r'BingBot',
            r'BingPreview',
            # Baidu search
            r'Baiduspider',
            # Yahoo
            r'Slurp',
            # Sogou
            r'Sogou',
            # facebook
            r'facebook',
            # Alexa
            r'ia_archiver',
            # Generic bot
            r'bots?[\/\s\)\;]',
            # Generic spider
            r'spider[\/\s\)\;]',
            # Slack - see https://api.slack.com/robots
            r'Slack',
            # Google indexing bot
            r'Calypso AppCrawler',
        )
    ),
    re.I
)


class WebCrawlersFilter(Filter):
    id = FilterStatKeys.WEB_CRAWLER
    name = 'Filter out known web crawlers'
    description = 'Some crawlers may execute pages in incompatible ways which then cause errors that are unlikely to be seen by a normal user.'
    default = True

    def get_user_agent(self, data):
        try:
            for key, value in get_path(data, 'request', 'headers', filter=True) or ():
                if key.lower() == 'user-agent':
                    return value
        except LookupError:
            return ''

    def test(self, data):
        """Return True if event with given user agent should be filtered out, False otherwise"""

        # TODO(dcramer): we could also look at UA parser and use the 'Spider'
        # device type
        user_agent = self.get_user_agent(data)
        if not user_agent:
            return False
        return bool(CRAWLERS.search(user_agent))
