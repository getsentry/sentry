import datetime
import logging
import re
from urllib.parse import parse_qs, urlparse, urlsplit

from sentry.integrations.client import ApiClient
from sentry.integrations.utils import get_query_hash
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import jwt
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.integrations.jira")

JIRA_KEY = f"{urlparse(absolute_uri()).hostname}.jira"
ISSUE_KEY_RE = re.compile(r"^[A-Za-z][A-Za-z0-9]*-\d+$")
CUSTOMFIELD_PREFIX = "customfield_"


class JiraCloud:
    """
    Contains the jira-cloud specifics that a JiraClient needs
    in order to communicate with jira
    """

    def __init__(self, shared_secret):
        self.shared_secret = shared_secret

    @property
    def cache_prefix(self):
        return "sentry-jira-2:"

    def request_hook(self, method, path, data, params, **kwargs):
        """
        Used by Jira Client to apply the jira-cloud authentication
        """
        # handle params that are already part of the path
        url_params = dict(parse_qs(urlsplit(path).query))
        url_params.update(params or {})
        path = path.split("?")[0]

        jwt_payload = {
            "iss": JIRA_KEY,
            "iat": datetime.datetime.utcnow(),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=5 * 60),
            "qsh": get_query_hash(path, method.upper(), url_params),
        }
        encoded_jwt = jwt.encode(jwt_payload, self.shared_secret)
        params = dict(jwt=encoded_jwt, **(url_params or {}))
        request_spec = kwargs.copy()
        request_spec.update(dict(method=method, path=path, data=data, params=params))
        return request_spec

    def user_id_field(self):
        """
        Jira-Cloud requires GDPR compliant API usage so we have to use accountId
        """
        return "accountId"

    def user_query_param(self):
        """
        Jira-Cloud requires GDPR compliant API usage so we have to use query
        """
        return "query"

    def user_id_get_param(self):
        """
        Jira-Cloud requires GDPR compliant API usage so we have to use accountId
        """
        return "accountId"


class JiraApiClient(ApiClient):
    # TODO: Update to v3 endpoints
    COMMENTS_URL = "/rest/api/2/issue/%s/comment"
    COMMENT_URL = "/rest/api/2/issue/%s/comment/%s"
    STATUS_URL = "/rest/api/2/status"
    CREATE_URL = "/rest/api/2/issue"
    ISSUE_URL = "/rest/api/2/issue/%s"
    META_URL = "/rest/api/2/issue/createmeta"
    PRIORITIES_URL = "/rest/api/2/priority"
    PROJECT_URL = "/rest/api/2/project"
    SEARCH_URL = "/rest/api/2/search/"
    VERSIONS_URL = "/rest/api/2/project/%s/versions"
    USERS_URL = "/rest/api/2/user/assignable/search"
    USER_URL = "/rest/api/2/user"
    SERVER_INFO_URL = "/rest/api/2/serverInfo"
    ASSIGN_URL = "/rest/api/2/issue/%s/assignee"
    TRANSITION_URL = "/rest/api/2/issue/%s/transitions"
    EMAIL_URL = "/rest/api/3/user/email"
    AUTOCOMPLETE_URL = "/rest/api/2/jql/autocompletedata/suggestions"
    PROPERTIES_URL = "/rest/api/3/issue/%s/properties/%s"

    integration_name = "jira"

    # This timeout is completely arbitrary. Jira doesn't give us any
    # caching headers to work with. Ideally we want a duration that
    # lets the user make their second jira issue with cached data.
    cache_time = 240

    def __init__(self, base_url, jira_style, verify_ssl, logging_context=None):
        self.base_url = base_url
        # `jira_style` encapsulates differences between jira server & jira cloud.
        # We only support one API version for Jira, but server/cloud require different
        # authentication mechanisms and caching.
        self.jira_style = jira_style
        super().__init__(verify_ssl, logging_context)

    def get_cache_prefix(self):
        return self.jira_style.cache_prefix

    def request(self, method, path, data=None, params=None, **kwargs):
        """
        Use the request_hook method for our specific style of Jira to
        add authentication data and transform parameters.
        """
        request_spec = self.jira_style.request_hook(method, path, data, params, **kwargs)
        if "headers" not in request_spec:
            request_spec["headers"] = {}

        # Force adherence to the GDPR compliant API conventions.
        # See
        # https://developer.atlassian.com/cloud/jira/platform/deprecation-notice-user-privacy-api-migration-guide
        request_spec["headers"]["x-atlassian-force-account-id"] = "true"
        return self._request(**request_spec)

    def user_id_get_param(self):
        return self.jira_style.user_id_get_param()

    def user_id_field(self):
        return self.jira_style.user_id_field()

    def user_query_param(self):
        return self.jira_style.user_query_param()

    def get_issue(self, issue_id):
        return self.get(self.ISSUE_URL % (issue_id,))

    def search_issues(self, query):
        q = query.replace('"', '\\"')
        # check if it looks like an issue id
        if ISSUE_KEY_RE.match(query):
            jql = f'id="{q}"'
        else:
            jql = f'text ~ "{q}"'
        return self.get(self.SEARCH_URL, params={"jql": jql})

    def create_comment(self, issue_key, comment):
        return self.post(self.COMMENTS_URL % issue_key, data={"body": comment})

    def update_comment(self, issue_key, comment_id, comment):
        return self.put(self.COMMENT_URL % (issue_key, comment_id), data={"body": comment})

    def get_projects_list(self):
        return self.get_cached(self.PROJECT_URL)

    def get_project_key_for_id(self, project_id):
        if not project_id:
            return ""
        projects = self.get_projects_list()
        for project in projects:
            if project["id"] == project_id:
                return project["key"].encode("utf-8")
        return ""

    def get_create_meta_for_project(self, project):
        params = {"expand": "projects.issuetypes.fields", "projectIds": project}
        metas = self.get_cached(self.META_URL, params=params)
        # We saw an empty JSON response come back from the API :(
        if not metas:
            logger.info(
                "jira.get-create-meta.empty-response",
                extra={"base_url": self.base_url, "project": project},
            )
            return None

        # XXX(dcramer): document how this is possible, if it even is
        if len(metas["projects"]) > 1:
            raise ApiError(f"More than one project found matching {project}.")

        try:
            return metas["projects"][0]
        except IndexError:
            logger.info(
                "jira.get-create-meta.key-error",
                extra={"base_url": self.base_url, "project": project},
            )
            return None

    def get_versions(self, project):
        return self.get_cached(self.VERSIONS_URL % project)

    def get_priorities(self):
        return self.get_cached(self.PRIORITIES_URL)

    def get_users_for_project(self, project):
        # Jira Server wants a project key, while cloud is indifferent.
        project_key = self.get_project_key_for_id(project)
        return self.get_cached(self.USERS_URL, params={"project": project_key})

    def search_users_for_project(self, project, username):
        # Jira Server wants a project key, while cloud is indifferent.
        project_key = self.get_project_key_for_id(project)
        return self.get_cached(
            self.USERS_URL, params={"project": project_key, self.user_query_param(): username}
        )

    def search_users_for_issue(self, issue_key, email):
        return self.get_cached(
            self.USERS_URL, params={"issueKey": issue_key, self.user_query_param(): email}
        )

    def get_user(self, user_id):
        user_id_get_param = self.user_id_get_param()
        return self.get_cached(self.USER_URL, params={user_id_get_param: user_id})

    def create_issue(self, raw_form_data):
        data = {"fields": raw_form_data}
        return self.post(self.CREATE_URL, data=data)

    def get_server_info(self):
        return self.get(self.SERVER_INFO_URL)

    def get_valid_statuses(self):
        return self.get_cached(self.STATUS_URL)

    def get_transitions(self, issue_key):
        return self.get_cached(self.TRANSITION_URL % issue_key)["transitions"]

    def transition_issue(self, issue_key, transition_id):
        return self.post(self.TRANSITION_URL % issue_key, {"transition": {"id": transition_id}})

    def assign_issue(self, key, name_or_account_id):
        user_id_field = self.user_id_field()
        return self.put(self.ASSIGN_URL % key, data={user_id_field: name_or_account_id})

    def set_issue_property(self, issue_key, badge_num):
        module_key = "sentry-issues-glance"
        properties_key = f"com.atlassian.jira.issue:{JIRA_KEY}:{module_key}:status"
        data = {"type": "badge", "value": {"label": badge_num}}
        return self.put(self.PROPERTIES_URL % (issue_key, properties_key), data=data)

    def get_email(self, account_id):
        user = self.get_cached(self.EMAIL_URL, params={"accountId": account_id})
        return user.get("email")

    def get_field_autocomplete(self, name, value):
        if name.startswith(CUSTOMFIELD_PREFIX):
            # Transform `customfield_0123` into `cf[0123]`
            cf_id = name[len(CUSTOMFIELD_PREFIX) :]
            jql_name = f"cf[{cf_id}]"
        else:
            jql_name = name
        return self.get_cached(
            self.AUTOCOMPLETE_URL, params={"fieldName": jql_name, "fieldValue": value}
        )
