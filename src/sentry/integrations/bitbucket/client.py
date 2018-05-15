from __future__ import absolute_import


from six.moves.urllib.parse import urlparse

from sentry.utils.http import absolute_uri
from sentry.integrations.atlassian_connect import integration_request

BITBUCKET_KEY = '%s.bitbucket' % urlparse(absolute_uri()).hostname


class BitbucketAPI(object):
    ALL_REPO_URL = '/2.0/repositories/%s'

    def __init__(self, base_url, shared_secret):
        self.base_url = base_url
        self.shared_secret = shared_secret

    def get_all_repositories(self, account):
        # Account can be either Team or User
        return integration_request(
            method='GET',
            path=self.ALL_REPO_URL % account,
            app_key=BITBUCKET_KEY,
            base_url=self.base_url,
            shared_secret=self.shared_secret,
        )
