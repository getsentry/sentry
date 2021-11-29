from typing import TYPE_CHECKING, Any, List, Mapping, Optional, Sequence, Union

from rest_framework.response import Response

from sentry.integrations.client import ApiClient, OAuth2RefreshMixin
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Identity, Project

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
    commit = "{instance}_apis/git/repositories/{repo_id}/commits/{commit_id}"
    commits = "{instance}_apis/git/repositories/{repo_id}/commits"
    commits_batch = "{instance}_apis/git/repositories/{repo_id}/commitsBatch"
    commits_changes = "{instance}_apis/git/repositories/{repo_id}/commits/{commit_id}/changes"
    project = "{instance}_apis/projects/{project_id}"
    projects = "{instance}_apis/projects"
    repository = "{instance}{project}_apis/git/repositories/{repo_id}"
    repositories = "{instance}{project}_apis/git/repositories"
    subscription = "{instance}_apis/hooks/subscriptions/{subscription_id}"
    subscriptions = "{instance}_apis/hooks/subscriptions"
    work_items = "{instance}_apis/wit/workitems/{id}"
    work_items_create = "{instance}{project}/_apis/wit/workitems/${type}"
    # TODO(lb): Fix this url so that the base url is given by vsts rather than built by us
    work_item_search = (
        "https://{account_name}.almsearch.visualstudio.com/_apis/search/workitemsearchresults"
    )
    work_item_states = "{instance}{project}/_apis/wit/workitemtypes/{type}/states"
    # TODO(lb): Fix this url so that the base url is given by vsts rather than built by us
    users = "https://{account_name}.vssps.visualstudio.com/_apis/graph/users"
    work_item_categories = "{instance}{project}/_apis/wit/workitemtypecategories"


class VstsApiClient(ApiClient, OAuth2RefreshMixin):  # type: ignore
    api_version = "4.1"  # TODO: update api version
    api_version_preview = "-preview.1"
    integration_name = "vsts"

    def __init__(
        self, identity: "Identity", oauth_redirect_url: str, *args: Any, **kwargs: Any
    ) -> None:
        super().__init__(*args, **kwargs)
        self.identity = identity
        self.oauth_redirect_url = oauth_redirect_url
        if "access_token" not in self.identity.data:
            raise ValueError("Vsts Identity missing access token")

    def request(
        self,
        method: str,
        path: str,
        data: Optional[Mapping[str, Any]] = None,
        params: Optional[Sequence[Any]] = None,
        api_preview: bool = False,
        timeout: Optional[int] = None,
    ) -> Response:
        self.check_auth(redirect_url=self.oauth_redirect_url)
        headers = {
            "Accept": "application/json; api-version={}{}".format(
                self.api_version, self.api_version_preview if api_preview else ""
            ),
            "Content-Type": "application/json-patch+json"
            if method == "PATCH"
            else "application/json",
            "X-HTTP-Method-Override": method,
            "X-TFS-FedAuthRedirect": "Suppress",
            "Authorization": "Bearer {}".format(self.identity.data["access_token"]),
        }
        return self._request(
            method, path, headers=headers, data=data, params=params, timeout=timeout
        )

    def create_work_item(
        self,
        instance: str,
        project: "Project",
        item_type: Optional[str] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        comment: Optional[str] = None,
        link: Optional[str] = None,
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
                instance=instance, project=project, type=item_type
            ),
            data=data,
        )

    def update_work_item(
        self,
        instance: str,
        id: str,
        title: UnsettableString = UNSET,
        description: UnsettableString = UNSET,
        link: UnsettableString = UNSET,
        comment: UnsettableString = UNSET,
        assigned_to: UnsettableString = UNSET,
        state: UnsettableString = UNSET,
    ) -> Response:
        data: List[Mapping[str, Any]] = []

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
                        "value": {"rel": "Hyperlink", "url": f_value}
                        if f_name == "link"
                        else f_value,
                    }
                )

        if comment is not UNSET and comment:
            data.append({"op": "add", "path": FIELD_MAP["comment"], "value": comment})

        return self.patch(VstsApiPath.work_items.format(instance=instance, id=id), data=data)

    def get_work_item(self, instance: str, id: str) -> Response:
        return self.get(VstsApiPath.work_items.format(instance=instance, id=id))

    def get_work_item_states(self, instance: str, project: str) -> Response:
        return self.get(
            VstsApiPath.work_item_states.format(
                instance=instance,
                project=project,
                # TODO(lb): might want to make this custom like jira at some point
                type="Bug",
            ),
            api_preview=True,
        )

    def get_work_item_categories(self, instance: str, project: str) -> Response:
        return self.get(VstsApiPath.work_item_categories.format(instance=instance, project=project))

    def get_repo(self, instance: str, name_or_id: str, project: Optional[str] = None) -> Response:
        return self.get(
            VstsApiPath.repository.format(
                instance=instance,
                project=f"{project}/" if project else "",
                repo_id=name_or_id,
            )
        )

    def get_repos(self, instance: str, project: Optional[str] = None) -> Response:
        return self.get(
            VstsApiPath.repositories.format(
                instance=instance, project=f"{project}/" if project else ""
            ),
            timeout=5,
        )

    def get_commits(self, instance: str, repo_id: str, commit: str, limit: int = 100) -> Response:
        return self.get(
            VstsApiPath.commits.format(instance=instance, repo_id=repo_id),
            params={"commit": commit, "$top": limit},
        )

    def get_commit(self, instance: str, repo_id: str, commit: str) -> Response:
        return self.get(
            VstsApiPath.commit.format(instance=instance, repo_id=repo_id, commit_id=commit)
        )

    def get_commit_filechanges(self, instance: str, repo_id: str, commit: str) -> Response:
        resp = self.get(
            VstsApiPath.commits_changes.format(instance=instance, repo_id=repo_id, commit_id=commit)
        )
        changes = resp["changes"]
        return changes

    def get_commit_range(
        self, instance: str, repo_id: str, start_sha: str, end_sha: str
    ) -> Response:
        return self.post(
            VstsApiPath.commits_batch.format(instance=instance, repo_id=repo_id),
            data={
                "itemVersion": {"versionType": "commit", "version": start_sha},
                "compareVersion": {"versionType": "commit", "version": end_sha},
            },
        )

    def get_project(self, instance: str, project_id: str) -> Response:
        return self.get(
            VstsApiPath.project.format(instance=instance, project_id=project_id),
            params={"stateFilter": "WellFormed"},
        )

    def get_projects(self, instance: str) -> Response:
        def gen_params(page_number: int, page_size: int) -> Mapping[str, Union[str, int]]:
            # ADO supports a continuation token in the response but only in the newer API version (
            # https://docs.microsoft.com/en-us/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-6.1
            # ). The token comes as a response header instead of the body and our API clients
            # currently only return the body we can use count, $skip, and $top to get the same result.
            offset = self.page_size * page_number
            return {"stateFilter": "WellFormed", "$skip": offset, "$top": page_size}

        def get_results(resp: Response) -> Sequence[Any]:
            # Explicitly typing to satisfy mypy.
            results: Sequence[Any] = resp["value"]
            return results

        return self.get_with_pagination(
            VstsApiPath.projects.format(instance=instance),
            gen_params=gen_params,
            get_results=get_results,
        )

    def get_users(self, account_name: str, continuation_token: Optional[str] = None) -> Response:
        """
        Gets Users with access to a given account/organization
        https://docs.microsoft.com/en-us/rest/api/azure/devops/graph/users/list?view=azure-devops-rest-4.1
        """
        return self.get(
            VstsApiPath.users.format(account_name=account_name),
            api_preview=True,
            params={"continuationToken": continuation_token},
        )

    def create_subscription(self, instance: Optional[str], shared_secret: str) -> Response:
        return self.post(
            VstsApiPath.subscriptions.format(instance=instance),
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

    def get_subscription(self, instance: str, subscription_id: str) -> Response:
        return self.get(
            VstsApiPath.subscription.format(instance=instance, subscription_id=subscription_id)
        )

    def delete_subscription(self, instance: str, subscription_id: str) -> Response:
        return self.delete(
            VstsApiPath.subscription.format(instance=instance, subscription_id=subscription_id)
        )

    def update_subscription(self, instance: str, subscription_id: str) -> Response:
        return self.put(
            VstsApiPath.subscription.format(instance=instance, subscription_id=subscription_id)
        )

    def search_issues(self, account_name: str, query: Optional[str] = None) -> Response:
        return self.post(
            VstsApiPath.work_item_search.format(account_name=account_name),
            data={"searchText": query, "$top": 1000},
            api_preview=True,
        )
