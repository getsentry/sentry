from __future__ import absolute_import

import re

from .base import Filter

# not all of these agents are guaranteed to execute JavaScript, but to avoid
# overhead of identifying which ones do, and which ones will over time we simply
# target all of the major ones
CRAWLERS = re.compile(r'|'.join((
    # various Google services
    r'AdsBot',
    # Google Adsense
    r'Mediapartners',
    # Google+ and Google web search
    r'Google',
    # Bing search
    r'BingBot',
    # Yahoo
    r'Slurp',
    # Sogou
    r'Sogou',
    # facebook
    r'facebook',
    # Alexa
    r'ia_archiver',
    # Generic bot
    r'bot[\/\s\)\;]',
    # Generic spider
    r'spider[\/\s\)\;]',
)), re.I)


class WebCrawlersFilter(Filter):
    id = 'web-crawlers'
    name = 'Filter out known web crawlers'
    description = 'Some crawlers may try to parse and execute JavaScript, but in an incompatible way which then triggers an error.'
    default = True

    def get_user_agent(self, data):
        try:
            for key, value in data['sentry.interfaces.Http']['headers']:
                if key.lower() == 'user-agent':
                    return value
        except LookupError:
            return ''

    def test(self, data):
        user_agent = self.get_user_agent(data)
        if not user_agent:
            return False
        return bool(CRAWLERS.search(user_agent))
