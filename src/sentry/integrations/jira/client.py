from __future__ import absolute_import

import datetime
import jwt
from six.moves.urllib.parse import urlparse

from sentry.http import build_session
from sentry.utils.http import absolute_uri

from .utils import get_query_hash

JIRA_KEY = '%s.jira' % (urlparse(absolute_uri()).hostname, )


class JiraApiClient(object):
    ISSUE_URL = '/rest/api/2/issue/%s'

    def __init__(self, base_url, shared_secret):
        self.base_url = base_url
        self.shared_secret = shared_secret

    def request(self, method, path, data=None, params=None, headers=None, **kwargs):
        jwt_payload = {
            'iss': JIRA_KEY,
            'iat': datetime.datetime.utcnow(),
            'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=5 * 60),
            'qsh': get_query_hash(path, method.upper(), params),
        }
        encoded_jwt = jwt.encode(jwt_payload, self.shared_secret)
        params = dict(
            jwt=encoded_jwt,
            **(params or {})
        )

        session = build_session()
        resp = session.request(
            method.lower(),
            url='%s%s' % (self.base_url, path),
            headers=headers,
            json=data,
            params=params,
        )

        resp.raise_for_status()
        return resp.json()

    def get_issue(self, issue_id):
        return self.request('GET', self.ISSUE_URL % (issue_id,))
