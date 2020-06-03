from __future__ import absolute_import

import six
from requests.exceptions import RequestException
from sentry import http
from sentry.utils import json

from .constants import API_DOMAIN


class GitHubApiError(Exception):
    def __init__(self, message="", status=0):
        super(GitHubApiError, self).__init__(message)
        self.status = status


class GitHubClient(object):
    def __init__(self, access_token):
        self.http = http.build_session()
        self.access_token = access_token

    def _request(self, path):
        headers = {"Authorization": "token {0}".format(self.access_token)}

        try:
            req = self.http.get(
                "https://{0}/{1}".format(API_DOMAIN, path.lstrip("/")), headers=headers,
            )
        except RequestException as e:
            raise GitHubApiError(six.text_type(e), status=getattr(e, "status_code", 0))
        if req.status_code < 200 or req.status_code >= 300:
            raise GitHubApiError(req.content, status=req.status_code)
        return json.loads(req.content)

    def get_org_list(self):
        return self._request("/user/orgs")

    def get_user(self):
        return self._request("/user")

    def get_user_emails(self):
        return self._request("/user/emails")

    def is_org_member(self, org_id):
        org_id = six.text_type(org_id)
        for o in self.get_org_list():
            if six.text_type((o["id"])) == org_id:
                return True
        return False
