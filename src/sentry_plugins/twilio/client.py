from base64 import b64encode

from django.utils.encoding import force_bytes

from sentry_plugins.client import ApiClient


class TwilioApiClient(ApiClient):
    plugin_name = "twilio"
    allow_redirects = False
    twilio_messages_endpoint = "https://api.twilio.com/2010-04-01/Accounts/{0}/Messages.json"

    def __init__(self, account_sid, auth_token, sms_from, sms_to):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.sms_from = sms_from
        self.sms_to = sms_to
        super().__init__()

    def basic_auth(self, user, password):
        return b"Basic " + b64encode(force_bytes(user + ":" + password))

    def request(self, data):
        endpoint = self.twilio_messages_endpoint.format(self.account_sid)
        headers = {"Authorization": self.basic_auth(self.account_sid, self.auth_token)}
        # Twilio doesn't accept the json headers, so set this to False
        # https://www.twilio.com/docs/usage/your-request-to-twilio#post
        return self._request(path=endpoint, method="post", data=data, headers=headers, json=False)
