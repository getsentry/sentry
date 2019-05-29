from __future__ import absolute_import
from sentry.utils.contexts_normalization import normalize_user_agent
from unittest import TestCase


class NormalizeUserAgentTests(TestCase):
    def setUp(self):
        self.data = {'request':
                     {'headers': [
                         [
                             'User-Agent',
                             'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.117 Safari/537.36'
                         ]
                     ]}
                     }

    def test_no_headers(self):
        self.data = {'request': {}}
        normalize_user_agent(self.data)
        assert 'contexts' not in self.data

    def test_headers_but_no_ua(self):
        self.data = {'request': {'headers': [['UA', 'a']]}}
        normalize_user_agent(self.data)
        assert 'contexts' not in self.data

    def test_headers_wrong_format(self):
        self.data = {'request': {'headers': ['UA', 'a']}}
        normalize_user_agent(self.data)
        assert 'contexts' not in self.data

    def test_broken_ua(self):
        self.data = {'request':
                     {'headers': [
                         [
                             'User-Agent',
                             'xx'
                         ]
                     ]}
                     }
        normalize_user_agent(self.data)
        assert self.data['contexts'] == {}

    def test_partial_browser_ua(self):
        self.data = {'request':
                     {'headers': [
                         [
                             'User-Agent',
                             'Mozilla/5.0  Version/12.0 Mobile/15E148 Safari/604.1'
                         ]
                     ]}
                     }
        normalize_user_agent(self.data)
        assert self.data['contexts']['browser']['name'] == 'Safari'
        assert self.data['contexts']['browser']['version'] == '12.0'
        assert 'os' not in self.data['contexts']
        assert 'device' not in self.data['contexts']

    def test_browser_device_os_parsed(self):
        self.data = {'request':
                     {'headers': [
                         [
                             'User-Agent',
                             'Mozilla/5.0 (iPhone; CPU iPhone OS 12_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1'
                         ]
                     ]}
                     }
        normalize_user_agent(self.data)
        assert self.data['contexts']['browser']['name'] == 'Mobile Safari'
        assert self.data['contexts']['browser']['version'] == '12.0'
        assert self.data['contexts']['os']['name'] == 'iOS'
        assert self.data['contexts']['os']['version'] == '12.1'
        assert self.data['contexts']['device']['brand'] == 'Apple'
        assert self.data['contexts']['device']['family'] == 'iPhone'
        assert self.data['contexts']['device']['model'] == 'iPhone'

    def test_contexts_none(self):
        self.data['contexts'] = None
        normalize_user_agent(self.data)
        assert self.data['contexts']['browser']['name'] == 'Chrome'
        assert self.data['contexts']['browser']['version'] == '66.0.3359'
        assert self.data['contexts']['os']['name'] == 'Mac OS X'
        assert self.data['contexts']['os']['version'] == '10.13.4'

    def test_browser_already_set(self):
        self.data['contexts'] = {'browser': {'name': 'IE', 'version': '6'}}
        normalize_user_agent(self.data)
        assert self.data['contexts']['browser']['name'] == 'IE'
        assert self.data['contexts']['browser']['version'] == '6'
        assert self.data['contexts']['os']['name'] == 'Mac OS X'
        assert self.data['contexts']['os']['version'] == '10.13.4'

    def test_browser_none(self):
        self.data['contexts'] = {'browser': None}
        normalize_user_agent(self.data)
        assert self.data['contexts']['browser']['name'] == 'Chrome'
        assert self.data['contexts']['browser']['version'] == '66.0.3359'

    def test_os_already_set(self):
        self.data['contexts'] = {'os': {'name': 'C64', 'version': '1337'}}
        normalize_user_agent(self.data)
        assert self.data['contexts']['browser']['name'] == 'Chrome'
        assert self.data['contexts']['browser']['version'] == '66.0.3359'
        assert self.data['contexts']['os']['name'] == 'C64'
        assert self.data['contexts']['os']['version'] == '1337'

    def test_os_none(self):
        self.data['contexts'] = {'os': None}
        normalize_user_agent(self.data)
        assert self.data['contexts']['os']['name'] == 'Mac OS X'
        assert self.data['contexts']['os']['version'] == '10.13.4'

    def test_device_already_set(self):
        self.data = {'request':
                     {'headers': [
                         [
                             'User-Agent',
                             'Mozilla/5.0 (iPhone; CPU iPhone OS 12_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1'
                         ]
                     ]}
                     }
        self.data['contexts'] = {'device': {'brand': 'TI Calculator'}}
        normalize_user_agent(self.data)
        assert self.data['contexts']['browser']['name'] == 'Mobile Safari'
        assert self.data['contexts']['browser']['version'] == '12.0'
        assert self.data['contexts']['os']['name'] == 'iOS'
        assert self.data['contexts']['os']['version'] == '12.1'
        assert self.data['contexts']['device']['brand'] == 'TI Calculator'

    def test_device_none(self):
        self.data = {
            'request': {
                'headers': [[
                    'User-Agent',
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 12_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
                ]],
            },
        }
        self.data['contexts'] = {'device': None}
        normalize_user_agent(self.data)
        assert self.data['contexts']['device']['brand'] == 'Apple'
        assert self.data['contexts']['device']['family'] == 'iPhone'
        assert self.data['contexts']['device']['model'] == 'iPhone'
