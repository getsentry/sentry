from __future__ import absolute_import

from sentry.integrations.client import ApiClient, OAuth2RefreshMixin
from sentry.utils.http import absolute_uri

UNSET = object()

FIELD_MAP = {
    "title": "/fields/System.Title",
    "description": "/fields/System.Description",
    "comment": "/fields/System.History",
    "link": "/relations/-",
    "assigned_to": "/fields/System.AssignedTo",
    "state": "/fields/System.State",
}
INVALID_ACCESS_TOKEN = "HTTP 400 (invalid_request): The access token is not valid"


class VstsApiPath(object):
    commit = u"{instance}_apis/git/repositories/{repo_id}/commits/{commit_id}"
    commits = u"{instance}_apis/git/repositories/{repo_id}/commits"
    commits_batch = u"{instance}_apis/git/repositories/{repo_id}/commitsBatch"
    commits_changes = u"{instance}_apis/git/repositories/{repo_id}/commits/{commit_id}/changes"
    project = u"{instance}_apis/projects/{project_id}"
    projects = u"{instance}_apis/projects"
    repository = u"{instance}{project}_apis/git/repositories/{repo_id}"
    repositories = u"{instance}{project}_apis/git/repositories"
    subscription = u"{instance}_apis/hooks/subscriptions/{subscription_id}"
    subscriptions = u"{instance}_apis/hooks/subscriptions"
    work_items = u"{instance}_apis/wit/workitems/{id}"
    work_items_create = u"{instance}{project}/_apis/wit/workitems/${type}"
    # TODO(lb): Fix this url so that the base url is given by vsts rather than built by us
    work_item_search = (
        u"https://{account_name}.almsearch.visualstudio.com/_apis/search/workitemsearchresults"
    )
    work_item_states = u"{instance}{project}/_apis/wit/workitemtypes/{type}/states"
    # TODO(lb): Fix this url so that the base url is given by vsts rather than built by us
    users = u"https://{account_name}.vssps.visualstudio.com/_apis/graph/users"
    work_item_categories = u"{instance}{project}/_apis/wit/workitemtypecategories"


class VstsApiClient(ApiClient, OAuth2RefreshMixin):
    api_version = "4.1"  # TODO: update api version
    api_version_preview = "-preview.1"
    integration_name = "vsts"

    def __init__(self, identity, oauth_redirect_url, *args, **kwargs):
        super(VstsApiClient, self).__init__(*args, **kwargs)
        self.identity = identity
        self.oauth_redirect_url = oauth_redirect_url
        if "access_token" not in self.identity.data:
            raise ValueError("Vsts Identity missing access token")

    def request(self, method, path, data=None, params=None, api_preview=False, timeout=None):
        self.check_auth(redirect_url=self.oauth_redirect_url)
        headers = {
            "Accept": u"application/json; api-version={}{}".format(
                self.api_version, self.api_version_preview if api_preview else ""
            ),
            "Content-Type": "application/json-patch+json"
            if method == "PATCH"
            else "application/json",
            "X-HTTP-Method-Override": method,
            "X-TFS-FedAuthRedirect": "Suppress",
            "Authorization": u"Bearer {}".format(self.identity.data["access_token"]),
        }
        return self._request(
            method, path, headers=headers, data=data, params=params, timeout=timeout
        )

    def create_work_item(
        self,
        instance,
        project,
        item_type=None,
        title=None,
        description=None,
        comment=None,
        link=None,
    ):
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
        instance,
        id,
        title=UNSET,
        description=UNSET,
        link=UNSET,
        comment=UNSET,
        assigned_to=UNSET,
        state=UNSET,
    ):
        data = []

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

    def get_work_item(self, instance, id):
        return self.get(VstsApiPath.work_items.format(instance=instance, id=id))

    def get_work_item_states(self, instance, project):
        return self.get(
            VstsApiPath.work_item_states.format(
                instance=instance,
                project=project,
                # TODO(lb): might want to make this custom like jira at some point
                type="Bug",
            ),
            api_preview=True,
        )

    def get_work_item_categories(self, instance, project):
        return self.get(VstsApiPath.work_item_categories.format(instance=instance, project=project))

    def get_repo(self, instance, name_or_id, project=None):
        return self.get(
            VstsApiPath.repository.format(
                instance=instance,
                project=u"{}/".format(project) if project else "",
                repo_id=name_or_id,
            )
        )

    def get_repos(self, instance, project=None):
        return self.get(
            VstsApiPath.repositories.format(
                instance=instance, project=u"{}/".format(project) if project else ""
            ),
            timeout=5,
        )

    def get_commits(self, instance, repo_id, commit, limit=100):
        return self.get(
            VstsApiPath.commits.format(instance=instance, repo_id=repo_id),
            params={"commit": commit, "$top": limit},
        )

    def get_commit(self, instance, repo_id, commit):
        return self.get(
            VstsApiPath.commit.format(instance=instance, repo_id=repo_id, commit_id=commit)
        )

    def get_commit_filechanges(self, instance, repo_id, commit):
        resp = self.get(
            VstsApiPath.commits_changes.format(instance=instance, repo_id=repo_id, commit_id=commit)
        )
        changes = resp["changes"]
        return changes

    def get_commit_range(self, instance, repo_id, start_sha, end_sha):
        return self.post(
            VstsApiPath.commits_batch.format(instance=instance, repo_id=repo_id),
            data={
                "itemVersion": {"versionType": "commit", "version": start_sha},
                "compareVersion": {"versionType": "commit", "version": end_sha},
            },
        )

    def get_project(self, instance, project_id):
        return self.get(
            VstsApiPath.project.format(instance=instance, project_id=project_id),
            params={"stateFilter": "WellFormed"},
        )

    def get_projects(self, instance):
        limit = 100  # 100 is max
        offset = 0
        projects = []

        # no one should have more than 1000 projects
        for i in range(10):
            # ADO supports a continuation token in the response but only in the newer API version (https://docs.microsoft.com/en-us/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-6.1)
            # the token comes as a repsponse header instead of the body and our API clients currently only return the body
            # we can use count, $skip, and $top to get the same result
            resp = self.get(
                VstsApiPath.projects.format(instance=instance),
                params={"stateFilter": "WellFormed", "$skip": offset, "$top": limit},
            )
            projects += resp["value"]
            offset += resp["count"]
            # if the number is lower than our limit, we can quit
            if resp["count"] < limit:
                return projects
        return projects

    def get_users(self, account_name, continuation_token=None):
        """
        Gets Users with access to a given account/organization
        https://docs.microsoft.com/en-us/rest/api/azure/devops/graph/users/list?view=azure-devops-rest-4.1
        """
        return self.get(
            VstsApiPath.users.format(account_name=account_name),
            api_preview=True,
            params={"continuationToken": continuation_token},
        )

    def create_subscription(self, instance, shared_secret):
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
                    "httpHeaders": "shared-secret:%s" % shared_secret,
                },
            },
        )

    def get_subscription(self, instance, subscription_id):
        return self.get(
            VstsApiPath.subscription.format(instance=instance, subscription_id=subscription_id)
        )

    def delete_subscription(self, instance, subscription_id):
        return self.delete(
            VstsApiPath.subscription.format(instance=instance, subscription_id=subscription_id)
        )

    def update_subscription(self, instance, subscription_id):
        return self.put(
            VstsApiPath.subscription.format(instance=instance, subscription_id=subscription_id)
        )

    def search_issues(self, account_name, query=None):
        return self.post(
            VstsApiPath.work_item_search.format(account_name=account_name),
            data={
                "searchText": query,
                "$top": 1000,
                "filters": {"System.WorkItemType": ["Bug", "User Story", "Feature", "Task"]},
            },
            api_preview=True,
        )
