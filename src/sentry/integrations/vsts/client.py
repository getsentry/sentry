from __future__ import annotations

from collections.abc import Mapping, Sequence
from time import time
from typing import TYPE_CHECKING, Any, Union
from urllib.parse import quote

from requests import PreparedRequest
from rest_framework.response import Response

from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidIdentity
from sentry.integrations.base import IntegrationFeatureNotImplementedError
from sentry.integrations.client import ApiClient
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.source_code_management.repository import RepositoryClient
from sentry.models.repository import Repository
from sentry.shared_integrations.client.base import BaseApiResponseX
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.silo.base import control_silo_function
from sentry.users.models.identity import Identity
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models.project import Project

UNSET = object()

UnsettableString = Union[str, object, None]

FIELD_MAP = {
    "title": "/fields/System.Title",
    "description": "/fields/System.Description",
    "comment": "/fields/System.History",
    "link": "/relations/-",
    "assigned_to": "/fields/System.AssignedTo",
    "state": "/fields/System.State",
}
INVALID_ACCESS_TOKEN = "HTTP 400 (invalid_request): The access token is not valid"


class VstsApiPath:
    """
    Endpoints used by the Azure Devops (Formerly 'Visual Studios Team Services') integration client.
    Last Updated: 06/2023
    """

    # https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get
    commit = "{instance}_apis/git/repositories/{repo_id}/commits/{commit_id}"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get-commits
    commits = "{instance}_apis/git/repositories/{repo_id}/commits"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get-commits-batch
    commits_batch = "{instance}_apis/git/repositories/{repo_id}/commitsBatch"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/git/commits/get-changes
    commits_changes = "{instance}_apis/git/repositories/{repo_id}/commits/{commit_id}/changes"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/git/items/get
    items = "{instance}{project}/_apis/git/repositories/{repo_id}/items"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/get
    project = "{instance}_apis/projects/{project_id}"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/list
    projects = "{instance}_apis/projects"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/git/repositories/get-repository
    repository = "{instance}{project}_apis/git/repositories/{repo_id}"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/git/repositories/list
    repositories = "{instance}{project}_apis/git/repositories"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/hooks/subscriptions/get
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/hooks/subscriptions/delete
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/hooks/subscriptions/replace-subscription
    subscription = "{instance}_apis/hooks/subscriptions/{subscription_id}"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/hooks/subscriptions/create
    subscriptions = "{instance}_apis/hooks/subscriptions"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-item
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update
    work_items = "{instance}_apis/wit/workitems/{id}"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/create
    work_items_create = "{instance}{project}/_apis/wit/workitems/${type}"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/search/work-item-search-results/fetch-work-item-search-results
    work_item_search = (
        # TODO(lb): Fix this url so that the base url is given by vsts rather than built by us
        "https://{account_name}.almsearch.visualstudio.com/_apis/search/workitemsearchresults"
    )
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-item-type-states/list
    work_item_states = "{instance}{project}/_apis/wit/workitemtypes/{type}/states"
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/graph/users/get
    users = (
        # TODO(lb): Fix this url so that the base url is given by vsts rather than built by us
        "https://{account_name}.vssps.visualstudio.com/_apis/graph/users"
    )
    # https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-item-type-categories/list
    work_item_categories = "{instance}{project}/_apis/wit/workitemtypecategories"


def prepare_headers(
    api_version: str,
    method: str,
    api_version_preview: str,
):

    headers = {
        "Accept": f"application/json; api-version={api_version}{api_version_preview}",
        "Content-Type": "application/json-patch+json" if method == "PATCH" else "application/json",
        "X-HTTP-Method-Override": method,
        "X-TFS-FedAuthRedirect": "Suppress",
    }
    return headers


def prepare_auth_header(
    access_token: str,
):
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    return headers


class VstsApiMixin:
    api_version = "4.1"  # TODO: update api version
    api_version_preview = "-preview.1"

    def create_subscription(self, shared_secret: str) -> Response:
        return self.post(
            VstsApiPath.subscriptions.format(instance=self.base_url),
            data={
                "publisherId": "tfs",
                "eventType": "workitem.updated",
                "resourceVersion": "1.0",
                "consumerId": "webHooks",
                "consumerActionId": "httpRequest",
                "consumerInputs": {
                    "url": absolute_uri("/extensions/vsts/issue-updated/"),
                    "resourceDetailsToSend": "all",
                    "httpHeaders": f"shared-secret:{shared_secret}",
                },
            },
        )


class VstsSetupApiClient(ApiClient, VstsApiMixin):
    integration_name = "vsts"

    def __init__(self, base_url: str, oauth_redirect_url: str, access_token: str):
        super().__init__()
        self.base_url = base_url
        self.oauth_redirect_url = oauth_redirect_url
        self.access_token = access_token

    def request(
        self, method, path, data=None, params=None, api_preview: bool = False
    ) -> BaseApiResponseX:
        headers = prepare_headers(
            api_version=self.api_version,
            method=method,
            api_version_preview=self.api_version_preview if api_preview else "",
        )
        headers.update(prepare_auth_header(access_token=self.access_token))
        return self._request(method, path, headers=headers, data=data, params=params)


class VstsApiClient(IntegrationProxyClient, VstsApiMixin, RepositoryClient):
    integration_name = "vsts"
    _identity: Identity | None = None

    def __init__(
        self,
        base_url: str,
        oauth_redirect_url: str,
        org_integration_id: int,
        identity_id: int | None = None,
    ) -> None:
        self.base_url = base_url
        self.identity_id = identity_id
        self.oauth_redirect_url = oauth_redirect_url
        super().__init__(org_integration_id=org_integration_id)

    @property
    def identity(self):
        if self._identity:
            return self._identity
        self._identity = Identity.objects.get(id=self.identity_id)
        return self._identity

    def request(self, method: str, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        api_preview = kwargs.pop("api_preview", False)
        headers = kwargs.pop("headers", {})
        new_headers = prepare_headers(
            api_version=self.api_version,
            method=method,
            api_version_preview=self.api_version_preview if api_preview else "",
        )
        headers.update(new_headers)

        return self._request(method, *args, headers=headers, **kwargs)

    @control_silo_function
    def _refresh_auth_if_expired(self):
        """
        Checks if auth is expired and if so refreshes it
        """
        time_expires = self.identity.data.get("expires")
        if time_expires is None:
            raise InvalidIdentity("VstsApiClient requires identity with specified expired time")
        if int(time_expires) <= int(time()):
            # TODO(iamrajjoshi): Remove this after migration
            # Need this here because there is no way to get any identifier which would tell us which method we should use to refresh the token
            from sentry.identity.vsts.provider import VSTSNewIdentityProvider
            from sentry.integrations.vsts.integration import VstsIntegrationProvider

            integration = integration_service.get_integration(
                organization_integration_id=self.org_integration_id, status=ObjectStatus.ACTIVE
            )
            # check if integration has migrated to new identity provider
            migration_version = integration.metadata.get("integration_migration_version", 0)
            if migration_version < VstsIntegrationProvider.CURRENT_MIGRATION_VERSION:
                self.identity.get_provider().refresh_identity(
                    self.identity, redirect_url=self.oauth_redirect_url
                )
            else:
                VSTSNewIdentityProvider().refresh_identity(
                    self.identity, redirect_url=self.oauth_redirect_url
                )

    @control_silo_function
    def authorize_request(
        self,
        prepared_request: PreparedRequest,
    ) -> PreparedRequest:
        self._refresh_auth_if_expired()
        access_token = self.identity.data["access_token"]
        headers = prepare_auth_header(
            access_token=access_token,
        )
        prepared_request.headers.update(headers)
        return prepared_request

    def create_work_item(
        self,
        project: Project,
        item_type: str | None = None,
        title: str | None = None,
        description: str | None = None,
        comment: str | None = None,
        link: str | None = None,
    ) -> Response:
        data = []
        if title:
            data.append({"op": "add", "path": FIELD_MAP["title"], "value": title})
        if description:
            data.append({"op": "add", "path": FIELD_MAP["description"], "value": description})
        if comment:
            data.append({"op": "add", "path": FIELD_MAP["comment"], "value": comment})
        # XXX: Link is not yet used, as we can't explicitly bind it to Sentry.
        # if link:
        #     data.append({
        #         'op': 'add',
        #         'path': FIELD_MAP['link'],
        #         'value': {
        #             'rel': 'Hyperlink',
        #             'url': link,
        #         }
        #     })

        return self.patch(
            VstsApiPath.work_items_create.format(
                instance=self.base_url, project=project, type=item_type
            ),
            data=data,
        )

    def update_work_item(
        self,
        id: str,
        title: UnsettableString = UNSET,
        description: UnsettableString = UNSET,
        link: UnsettableString = UNSET,
        comment: UnsettableString = UNSET,
        assigned_to: UnsettableString = UNSET,
        state: UnsettableString = UNSET,
    ) -> Response:
        data: list[Mapping[str, Any]] = []

        for f_name, f_value in (
            ("title", title),
            ("description", description),
            ("link", link),
            ("assigned_to", assigned_to),
            ("state", state),
        ):
            if f_name == "link":
                # XXX: Link is not yet used, as we can't explicitly bind it to Sentry.
                continue
            elif f_value is None:
                data.append({"op": "remove", "path": FIELD_MAP[f_name]})
            elif f_value is not UNSET:
                data.append(
                    {
                        # TODO(dcramer): this is problematic when the link already exists
                        "op": "replace" if f_name != "link" else "add",
                        "path": FIELD_MAP[f_name],
                        "value": (
                            {"rel": "Hyperlink", "url": f_value} if f_name == "link" else f_value
                        ),
                    }
                )

        if comment is not UNSET and comment:
            data.append({"op": "add", "path": FIELD_MAP["comment"], "value": comment})

        return self.patch(VstsApiPath.work_items.format(instance=self.base_url, id=id), data=data)

    def get_work_item(self, id: int) -> Response:
        return self.get(VstsApiPath.work_items.format(instance=self.base_url, id=id))

    def get_work_item_states(self, project: str) -> Response:
        # XXX: Until we add the option to enter the 'WorkItemType' for syncing status changes from
        # Sentry to Azure DevOps, we need will attempt to use the sequence below. There are certain
        # ADO configurations which don't have 'Bug' or 'Issue', hence iterating until we find a match.
        check_sequence = ["Bug", "Issue", "Task"]
        response = None
        for check_type in check_sequence:
            response = self.get(
                VstsApiPath.work_item_states.format(
                    instance=self.base_url,
                    project=project,
                    type=check_type,
                ),
                api_preview=True,
            )
            if response.get("count", 0) > 0:
                break
        return response

    def get_work_item_categories(self, project: str) -> Response:
        return self.get(
            VstsApiPath.work_item_categories.format(instance=self.base_url, project=project)
        )

    def get_repo(self, name_or_id: str, project: str | None = None) -> Response:
        return self.get(
            VstsApiPath.repository.format(
                instance=self.base_url,
                project=f"{project}/" if project else "",
                repo_id=name_or_id,
            )
        )

    def get_repos(self, project: str | None = None) -> Response:
        return self.get(
            VstsApiPath.repositories.format(
                instance=self.base_url, project=f"{project}/" if project else ""
            ),
            timeout=5,
        )

    def get_commits(self, repo_id: str, commit: str, limit: int = 100) -> Response:
        return self.get(
            VstsApiPath.commits.format(instance=self.base_url, repo_id=repo_id),
            params={"commit": commit, "$top": limit},
        )

    def get_commit(self, repo_id: str, commit: str) -> Response:
        return self.get(
            VstsApiPath.commit.format(instance=self.base_url, repo_id=repo_id, commit_id=commit)
        )

    def get_commit_filechanges(self, repo_id: str, commit: str) -> Response:
        resp = self.get(
            VstsApiPath.commits_changes.format(
                instance=self.base_url, repo_id=repo_id, commit_id=commit
            )
        )
        changes = resp["changes"]
        return changes

    def get_commit_range(self, repo_id: str, start_sha: str, end_sha: str) -> Response:
        return self.post(
            VstsApiPath.commits_batch.format(instance=self.base_url, repo_id=repo_id),
            data={
                "itemVersion": {"versionType": "commit", "version": start_sha},
                "compareVersion": {"versionType": "commit", "version": end_sha},
            },
        )

    def get_project(self, project_id: str) -> Response:
        return self.get(
            VstsApiPath.project.format(instance=self.base_url, project_id=project_id),
            params={"stateFilter": "WellFormed"},
        )

    def get_projects(self) -> list[dict[str, Any]]:
        def gen_params(page_number: int, page_size: int) -> Mapping[str, str | int]:
            # ADO supports a continuation token in the response but only in the newer API version (
            # https://docs.microsoft.com/en-us/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-6.1
            # ). The token comes as a response header instead of the body and our API clients
            # currently only return the body we can use count, $skip, and $top to get the same result.
            offset = self.page_size * page_number
            return {"stateFilter": "WellFormed", "$skip": offset, "$top": page_size}

        def get_results(resp: Response) -> Sequence[Any]:
            return resp["value"]

        return self.get_with_pagination(
            VstsApiPath.projects.format(instance=self.base_url),
            gen_params=gen_params,
            get_results=get_results,
        )

    def get_users(self, account_name: str, continuation_token: str | None = None) -> Response:
        """
        Gets Users with access to a given account/organization
        https://docs.microsoft.com/en-us/rest/api/azure/devops/graph/users/list?view=azure-devops-rest-4.1
        """
        return self.get(
            VstsApiPath.users.format(account_name=account_name),
            api_preview=True,
            params={"continuationToken": continuation_token},
        )

    def get_subscription(self, subscription_id: str) -> Response:
        return self.get(
            VstsApiPath.subscription.format(instance=self.base_url, subscription_id=subscription_id)
        )

    def delete_subscription(self, subscription_id: str) -> Response:
        return self.delete(
            VstsApiPath.subscription.format(instance=self.base_url, subscription_id=subscription_id)
        )

    def update_subscription(self, subscription_id: str) -> Response:
        return self.put(
            VstsApiPath.subscription.format(instance=self.base_url, subscription_id=subscription_id)
        )

    def search_issues(self, account_name: str, query: str | None = None) -> Response:
        return self.post(
            VstsApiPath.work_item_search.format(account_name=account_name),
            data={"searchText": query, "$top": 1000},
            api_preview=True,
        )

    def check_file(self, repo: Repository, path: str, version: str | None) -> BaseApiResponseX:
        return self.get_cached(
            path=VstsApiPath.items.format(
                instance=repo.config["instance"],
                project=quote(repo.config["project"]),
                repo_id=quote(repo.config["name"]),
            ),
            params={
                "path": path,
                "api-version": "7.0",
                "versionDescriptor.version": version,
            },
        )

    def get_file(
        self, repo: Repository, path: str, ref: str | None, codeowners: bool = False
    ) -> str:
        raise IntegrationFeatureNotImplementedError
