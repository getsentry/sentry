from __future__ import absolute_import

from sentry.models import Project
from sentry.filters.web_crawlers import WebCrawlersFilter
from unittest import TestCase


class WebCrawlersFilterTest(TestCase):
    filter_cls = WebCrawlersFilter

    def apply_filter(self, data):
        project = Project()
        return self.filter_cls(project).test(data)

    def get_mock_data(self, user_agent):
        return {
            'request': {
                'url': 'http://example.com',
                'method': 'GET',
                'headers': [
                    ['User-Agent', user_agent],
                ]
            }
        }

    def test_filters_google_adsense(self):
        data = self.get_mock_data('Mediapartners-Google')
        assert self.apply_filter(data)

    def test_filters_google_adsbot(self):
        data = self.get_mock_data('AdsBot-Google (+http://www.google.com/adsbot.html)')
        assert self.apply_filter(data)

    def test_filters_google_bot(self):
        data = self.get_mock_data(
            'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
        assert self.apply_filter(data)

    def test_filters_google_feedfetcher(self):
        data = self.get_mock_data('FeedFetcher-Google; (+http://www.google.com/feedfetcher.html)')
        assert self.apply_filter(data)

    def test_does_not_filter_google_pubsub(self):
        data = self.get_mock_data(
            'APIs-Google (+https://developers.google.com/webmasters/APIs-Google.html)')
        assert not self.apply_filter(data)

    def test_does_not_filter_chrome(self):
        data = self.get_mock_data(
            'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
        )
        assert not self.apply_filter(data)

    def test_filters_twitterbot(self):
        data = self.get_mock_data('Twitterbot/1.0')
        assert self.apply_filter(data)

    def test_filters_slack(self):
        data = self.get_mock_data('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)')
        assert self.apply_filter(data)

        data = self.get_mock_data('Slack-ImgProxy 0.19 (+https://api.slack.com/robots)')
        assert self.apply_filter(data)

        data = self.get_mock_data('Slackbot 1.0(+https://api.slack.com/robots)')
        assert self.apply_filter(data)

    def test_filters_calypso_appcrawler(self):
        data = self.get_mock_data(
            'Mozilla/5.0 (Linux; Android 6.0.1; Calypso AppCrawler Build/MMB30Y; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.124 Mobile Safari/537.36'
        )
        assert self.apply_filter(data)

    def test_filters_google_apis(self):
        data = self.get_mock_data('APIs-Google')
        assert not self.apply_filter(data)
