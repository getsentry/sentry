from __future__ import absolute_import

from sentry.integrations import ApiClient


class PagerDutyClient(ApiClient):
    allow_redirects = False
    integration_name = 'pagerduty'

    def __init__(self):
        super(PagerDutyClient, self).__init__()

    def request(self, data):
        pass

    def send_trigger(data):
        pass

    def send_acknowledge(data):
        pass

    def send_resolve(data):
        pass
