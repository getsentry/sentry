import logging
import re
from hashlib import md5 as _md5

from django.utils.encoding import force_bytes

from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.cache import cache
from sentry_plugins.client import ApiClient

log = logging.getLogger(__name__)


def md5(*bits):
    return _md5(b":".join(force_bytes(bit, errors="replace") for bit in bits))


class JiraClient(ApiClient):
    """
    The JIRA API Client, so you don't have to.
    """

    PROJECT_URL = "/rest/api/2/project"
    META_URL = "/rest/api/2/issue/createmeta"
    CREATE_URL = "/rest/api/2/issue"
    PRIORITIES_URL = "/rest/api/2/priority"
    VERSIONS_URL = "/rest/api/2/project/{}/versions"
    USERS_URL = "/rest/api/2/user/assignable/search"
    ISSUE_URL = "/rest/api/2/issue/{}"
    SEARCH_URL = "/rest/api/2/search/"
    COMMENT_URL = "/rest/api/2/issue/{}/comment"
    HTTP_TIMEOUT = 5
    plugin_name = "jira"

    def __init__(self, instance_uri, username, password):
        self.base_url = instance_uri.rstrip("/")
        self.username = username
        self.password = password
        super().__init__(verify_ssl=False)

    def request(self, method, path, data=None, params=None):
        if self.username and self.password:
            auth = self.username.encode("utf8"), self.password.encode("utf8")
        else:
            auth = None
        return self._request(method, path, data=data, params=params, auth=auth)

    def get_projects_list(self):
        return self.get_cached(self.PROJECT_URL)

    def get_create_meta(self, project):
        return self.get(
            self.META_URL, params={"projectKeys": project, "expand": "projects.issuetypes.fields"}
        )

    def get_create_meta_for_project(self, project):
        metas = self.get_create_meta(project)
        # We saw an empty JSON response come back from the API :(
        if not metas:
            return None

        # XXX(dcramer): document how this is possible, if it even is
        if len(metas["projects"]) > 1:
            raise ApiError("More than one project found.")

        try:
            return metas["projects"][0]
        except IndexError:
            return None

    def get_versions(self, project):
        return self.get_cached(self.VERSIONS_URL.format(project))

    def get_priorities(self):
        return self.get_cached(self.PRIORITIES_URL)

    def get_users_for_project(self, project):
        return self.get(self.USERS_URL, params={"project": project})

    def search_users_for_project(self, project, username):
        return self.get(self.USERS_URL, params={"project": project, "username": username})

    def create_issue(self, raw_form_data):
        data = {"fields": raw_form_data}
        return self.post(self.CREATE_URL, data=data)

    def get_issue(self, key):
        return self.get(self.ISSUE_URL.format(key))

    def create_comment(self, issue_key, comment):
        return self.post(self.COMMENT_URL.format(issue_key), data={"body": comment})

    def search_issues(self, project, query):
        # check if it looks like an issue id
        if re.search(r"^[A-Za-z]+-\d+$", query) and project.lower() in query.lower():
            jql = 'id="{}"'.format(query.replace('"', '\\"'))
        else:
            jql = 'text ~ "{}"'.format(query.replace('"', '\\"'))
        jql = f'project="{project}" AND {jql}'
        return self.get(self.SEARCH_URL, params={"jql": jql})

    # Steve(XXX): Might consider moving this method to the base plugin API client
    def get_cached(self, full_url):
        """
        Basic Caching mechanism for requests and responses. It only caches responses
        based on URL
        TODO: Implement GET attr in cache as well. (see self.create_meta for example)
        """
        key = "sentry-jira:" + md5(full_url, self.base_url).hexdigest()
        cached_result = cache.get(key)
        if not cached_result:
            cached_result = self.get(full_url)
            cache.set(key, cached_result, 60)
        return cached_result
