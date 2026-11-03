import datetime
import logging
from collections.abc import Mapping
from typing import Any, cast
from urllib.parse import parse_qs, urlparse, urlsplit

from requests import PreparedRequest

from sentry.integrations.client import ApiClient
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.atlassian_connect import get_query_hash
from sentry.integrations.utils.jira import parse_jira_issue_key
from sentry.shared_integrations.exceptions import ApiError
from sentry.shared_integrations.response import MappingApiResponse, SequenceApiResponse
from sentry.utils import jwt
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.integrations.jira")

JIRA_KEY = f"{urlparse(absolute_uri()).hostname}.jira"
CUSTOMFIELD_PREFIX = "customfield_"

STATUS_SEARCH_PAGE_SIZE = 200
STATUS_SEARCH_MAX_PAGES = 20


class JiraCloudClient(ApiClient):
    # TODO: Update to v3 endpoints
    COMMENTS_URL = "/rest/api/2/issue/%s/comment"
    COMMENT_URL = "/rest/api/2/issue/%s/comment/%s"
    STATUS_URL = "/rest/api/2/status"
    CREATE_URL = "/rest/api/2/issue"
    ISSUE_URL = "/rest/api/2/issue/%s"
    META_URL = "/rest/api/2/issue/createmeta"
    PRIORITIES_URL = "/rest/api/2/priority"
    PROJECTS_PAGINATED_URL = "/rest/api/2/project/search"
    PROJECT_URL = "/rest/api/2/project"
    SEARCH_URL = "/rest/api/2/search/jql/"
    VERSIONS_URL = "/rest/api/2/project/%s/versions"
    USERS_URL = "/rest/api/2/user/assignable/search"
    USER_URL = "/rest/api/2/user"
    SERVER_INFO_URL = "/rest/api/2/serverInfo"
    STATUS_SEARCH_URL = "/rest/api/2/statuses/search"
    ASSIGN_URL = "/rest/api/2/issue/%s/assignee"
    TRANSITION_URL = "/rest/api/2/issue/%s/transitions"
    EMAIL_URL = "/rest/api/3/user/email"
    AUTOCOMPLETE_URL = "/rest/api/2/jql/autocompletedata/suggestions"
    PROPERTIES_URL = "/rest/api/3/issue/%s/properties/%s"

    integration_name = IntegrationProviderSlug.JIRA.value
    # Configures `get_with_pagination`, used by the paginated `get_project_statuses`.
    page_size = STATUS_SEARCH_PAGE_SIZE
    page_number_limit = STATUS_SEARCH_MAX_PAGES

    # This timeout is completely arbitrary. Jira doesn't give us any
    # caching headers to work with. Ideally we want a duration that
    # lets the user make their second jira issue with cached data.
    cache_time = 240

    def __init__(
        self,
        integration: RpcIntegration | Integration,
        verify_ssl: bool,
        logging_context: Any | None = None,
    ) -> None:
        self.base_url = integration.metadata["base_url"]
        self.shared_secret = integration.metadata["shared_secret"]
        super().__init__(
            integration_id=integration.id,
            verify_ssl=verify_ssl,
            logging_context=logging_context,
        )

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        assert prepared_request.url is not None
        assert prepared_request.method is not None
        path = prepared_request.url[len(self.base_url) :]
        url_params = dict(parse_qs(urlsplit(path).query))
        path = path.split("?")[0]
        now = datetime.datetime.now(datetime.UTC)
        jwt_payload = {
            "iss": JIRA_KEY,
            "iat": now,
            "exp": now + datetime.timedelta(seconds=5 * 60),
            "qsh": get_query_hash(
                uri=path,
                method=prepared_request.method.upper(),
                query_params=url_params,
            ),
        }
        encoded_jwt = jwt.encode(jwt_payload, self.shared_secret)
        prepared_request.headers["Authorization"] = f"JWT {encoded_jwt}"
        return prepared_request

    def get_cache_prefix(self) -> str:
        return "sentry-jira-2:"

    def user_id_get_param(self) -> str:
        """
        Jira-Cloud requires GDPR compliant API usage so we have to use accountId
        """
        return "accountId"

    def user_id_field(self) -> str:
        """
        Jira-Cloud requires GDPR compliant API usage so we have to use accountId
        """
        return "accountId"

    def user_query_param(self) -> str:
        """
        Jira-Cloud requires GDPR compliant API usage so we have to use query
        """
        return "query"

    def get_issue(self, issue_id: str) -> MappingApiResponse:
        return self.get_mapping(self.ISSUE_URL % (issue_id,))

    def search_issues(self, query: str) -> MappingApiResponse:
        issue_key = parse_jira_issue_key(query, self.base_url)
        if issue_key is not None:
            # the key pattern cannot contain a quote, so it needs no escaping
            jql = f'id="{issue_key}"'
        else:
            q = query.replace('"', '\\"')
            jql = f'text ~ "{q}"'
        return self.get_mapping(self.SEARCH_URL, params={"jql": jql, "fields": "*all"})

    def create_comment(self, issue_key: str, comment: str) -> MappingApiResponse:
        return self.post_mapping(self.COMMENTS_URL % issue_key, data={"body": comment})

    def update_comment(self, issue_key: str, comment_id: str, comment: str) -> MappingApiResponse:
        return self.put_mapping(self.COMMENT_URL % (issue_key, comment_id), data={"body": comment})

    def get_projects_paginated(
        self, params: Mapping[str, object] | None = None
    ) -> MappingApiResponse:
        return self.get_mapping(self.PROJECTS_PAGINATED_URL, params=params)

    def get_projects_list(self) -> SequenceApiResponse:
        """deprecated - please use paginated projects endpoint"""
        return self.get_cached_sequence(self.PROJECT_URL)

    def get_project_key_for_id(self, project_id: str | int) -> str:
        if not project_id:
            return ""
        projects = self.get_projects_list()
        for project in projects:
            if project["id"] == project_id:
                return project["key"]
        return ""

    def get_create_meta_for_project(self, project: str | int) -> MappingApiResponse | None:
        params = {"expand": "projects.issuetypes.fields", "projectIds": project}
        metas = self.get_cached_mapping(self.META_URL, params=params)
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
            return cast(MappingApiResponse, metas["projects"][0])
        except IndexError:
            logger.info(
                "jira.get-create-meta.key-error",
                extra={"base_url": self.base_url, "project": project},
            )
            return None

    def get_versions(self, project: str | int) -> SequenceApiResponse:
        return self.get_cached_sequence(self.VERSIONS_URL % project)

    def get_priorities(self) -> SequenceApiResponse:
        return self.get_cached_sequence(self.PRIORITIES_URL)

    def search_users_for_project(self, project: str | int, username: str) -> SequenceApiResponse:
        # Jira Server wants a project key, while cloud is indifferent.
        project_key = self.get_project_key_for_id(project)
        return self.get_cached_sequence(
            self.USERS_URL, params={"project": project_key, self.user_query_param(): username}
        )

    def search_users_for_issue(self, issue_key: str, email: str) -> SequenceApiResponse:
        return self.get_cached_sequence(
            self.USERS_URL, params={"issueKey": issue_key, self.user_query_param(): email}
        )

    def get_user(self, user_id: str) -> MappingApiResponse:
        user_id_get_param = self.user_id_get_param()
        return self.get_cached_mapping(self.USER_URL, params={user_id_get_param: user_id})

    def create_issue(self, raw_form_data: Mapping[str, object]) -> MappingApiResponse:
        data = {"fields": raw_form_data}
        return self.post_mapping(self.CREATE_URL, data=data)

    def get_server_info(self) -> MappingApiResponse:
        return self.get_mapping(self.SERVER_INFO_URL)

    def get_valid_statuses(self) -> SequenceApiResponse:
        return self.get_cached_sequence(self.STATUS_URL)

    def get_transitions(self, issue_key: str) -> SequenceApiResponse:
        return cast(
            SequenceApiResponse, self.get_mapping(self.TRANSITION_URL % issue_key)["transitions"]
        )

    def transition_issue(self, issue_key: str, transition_id: str) -> MappingApiResponse:
        return self.post_mapping(
            self.TRANSITION_URL % issue_key, data={"transition": {"id": transition_id}}
        )

    def assign_issue(self, key: str, name_or_account_id: str) -> MappingApiResponse:
        user_id_field = self.user_id_field()
        return self.put_mapping(self.ASSIGN_URL % key, data={user_id_field: name_or_account_id})

    def set_issue_property(self, issue_key: str, badge_num: int) -> MappingApiResponse:
        module_key = "sentry-issues-glance"
        properties_key = f"com.atlassian.jira.issue:{JIRA_KEY}:{module_key}:status"
        data = {"type": "badge", "value": {"label": badge_num}}
        return self.put_mapping(self.PROPERTIES_URL % (issue_key, properties_key), data=data)

    def get_email(self, account_id: str | None) -> str | None:
        user = self.get_cached_mapping(self.EMAIL_URL, params={"accountId": account_id})
        email = user.get("email")
        return email

    def get_field_autocomplete(self, name: str, value: str) -> MappingApiResponse:
        if name.startswith(CUSTOMFIELD_PREFIX):
            # Transform `customfield_0123` into `cf[0123]`
            cf_id = name[len(CUSTOMFIELD_PREFIX) :]
            jql_name = f"cf[{cf_id}]"
        else:
            jql_name = name
        return self.get_cached_mapping(
            self.AUTOCOMPLETE_URL, params={"fieldName": jql_name, "fieldValue": value}
        )

    def get_project_statuses(self, project_id: str, paginate: bool = False) -> dict[str, Any]:
        if not paginate:
            # TODO: Remove this after rolling out lazy status feature flag fully
            return dict(
                self.get_cached_mapping(self.STATUS_SEARCH_URL, params={"projectId": project_id})
            )

        values = self.get_with_pagination(
            self.STATUS_SEARCH_URL,
            gen_params=lambda page_num, page_size: {
                "projectId": project_id,
                "startAt": page_num * page_size,
                "maxResults": page_size,
            },
            get_results=lambda resp: resp.get("values", []),
        )
        return {"values": values}
