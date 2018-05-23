from __future__ import absolute_import

import datetime
import jwt
import re
from hashlib import md5 as _md5
from six.moves.urllib.parse import urlparse

from sentry.utils.cache import cache
from django.utils.encoding import force_bytes

from sentry.integrations.atlassian_connect import get_query_hash
from sentry.integrations.exceptions import ApiError
from sentry.integrations.client import ApiClient
from sentry.utils.http import absolute_uri


JIRA_KEY = '%s.jira' % (urlparse(absolute_uri()).hostname, )


def md5(*bits):
    return _md5(':'.join((force_bytes(bit, errors='replace') for bit in bits)))


class JiraApiClient(ApiClient):
    COMMENT_URL = '/rest/api/2/issue/%s/comment'
    STATUS_URL = '/rest/api/2/status'
    CREATE_URL = '/rest/api/2/issue'
    ISSUE_URL = '/rest/api/2/issue/%s'
    META_URL = '/rest/api/2/issue/createmeta'
    PRIORITIES_URL = '/rest/api/2/priority'
    PROJECT_URL = '/rest/api/2/project'
    SEARCH_URL = '/rest/api/2/search/'
    VERSIONS_URL = '/rest/api/2/project/%s/versions'
    USERS_URL = '/rest/api/2/user/assignable/search'

    def __init__(self, base_url, shared_secret):
        self.base_url = base_url
        self.shared_secret = shared_secret
        super(JiraApiClient, self).__init__(verify_ssl=False)

    def request(self, method, path, data=None, params=None, **kwargs):
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
        return self._request(method, path, data=data, params=params, **kwargs)

    def get_cached(self, full_url):
        """
        Basic Caching mechanism for requests and responses. It only caches responses
        based on URL
        TODO: Implement GET attr in cache as well. (see self.create_meta for example)
        """
        key = 'sentry-jira-2:' + md5(full_url, self.base_url).hexdigest()
        cached_result = cache.get(key)
        if not cached_result:
            cached_result = self.get(full_url)
            cache.set(key, cached_result, 60)
        return cached_result

    def get_issue(self, issue_id):
        return self.get(self.ISSUE_URL % (issue_id,))

    def search_issues(self, query):
        # check if it looks like an issue id
        if re.search(r'^[A-Za-z]+-\d+$', query):
            jql = 'id="%s"' % query.replace('"', '\\"')
        else:
            jql = 'text ~ "%s"' % query.replace('"', '\\"')
        return self.get(self.SEARCH_URL, params={'jql': jql})

    def create_comment(self, issue_key, comment):
        return self.post(self.COMMENT_URL % issue_key, data={'body': comment})

    def get_projects_list(self):
        return self.get_cached(self.PROJECT_URL)

    def get_create_meta(self, project=None):
        params = {'expand': 'projects.issuetypes.fields'}
        if project is not None:
            params['projectIds'] = project
        return self.get(
            self.META_URL,
            params=params,
        )

    def get_create_meta_for_project(self, project):
        metas = self.get_create_meta(project)
        # We saw an empty JSON response come back from the API :(
        if not metas:
            return None

        # XXX(dcramer): document how this is possible, if it even is
        if len(metas['projects']) > 1:
            raise ApiError('More than one project found.')

        try:
            return metas['projects'][0]
        except IndexError:
            return None

    def get_versions(self, project):
        return self.get_cached(self.VERSIONS_URL % project)

    def get_priorities(self):
        return self.get_cached(self.PRIORITIES_URL)

    def get_users_for_project(self, project):
        return self.get(self.USERS_URL, params={'project': project})

    def search_users_for_project(self, project, username):
        return self.get(self.USERS_URL, params={'project': project, 'username': username})

    def create_issue(self, raw_form_data):
        data = {'fields': raw_form_data}
        return self.post(self.CREATE_URL, data=data)

    def get_valid_statuses(self):
        return self.request('GET', self.STATUS_URL)
