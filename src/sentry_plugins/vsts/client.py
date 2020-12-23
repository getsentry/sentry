from __future__ import absolute_import

from sentry_plugins.client import AuthApiClient

UNSET = object()

FIELD_MAP = {
    "title": "/fields/System.Title",
    "description": "/fields/System.Description",
    "comment": "/fields/System.History",
    "link": "/relations/-",
}


class VstsClient(AuthApiClient):
    api_version = "4.1"
    plugin_name = "vsts"

    def request(self, method, path, data=None, params=None):
        headers = {
            "Accept": "application/json; api-version={}".format(self.api_version),
            "Content-Type": "application/json-patch+json"
            if method == "PATCH"
            else "application/json",
            "X-HTTP-Method-Override": method,
            "X-TFS-FedAuthRedirect": "Suppress",
        }
        return self._request(method, path, headers=headers, data=data, params=params)

    def create_work_item(
        self, instance, project, title=None, description=None, comment=None, link=None
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
            "https://{}/{}/_apis/wit/workitems/$Bug".format(instance, project), data=data
        )

    def update_work_item(
        self, instance, id, title=UNSET, description=UNSET, link=UNSET, comment=UNSET
    ):
        data = []

        for f_name, f_value in (("title", title), ("description", description), ("link", link)):
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

        return self.patch(
            "https://{}/DefaultCollection/_apis/wit/workitems/{}".format(instance, id), data=data
        )

    def get_work_item(self, instance, id):
        return self.get("https://{}/DefaultCollection/_apis/wit/workitems/{}".format(instance, id))

    def get_repo(self, instance, name_or_id, project=None):
        return self.get(
            "https://{}/DefaultCollection/{}_apis/git/repositories/{}".format(
                instance, "{}/".format(project) if project else "", name_or_id
            )
        )

    def get_commits(self, instance, repo_id, commit, limit=100):
        return self.get(
            "https://{}/DefaultCollection/_apis/git/repositories/{}/commits".format(
                instance, repo_id
            ),
            params={"commit": commit, "$top": limit},
        )

    def get_commit_filechanges(self, instance, repo_id, commit):

        resp = self.get(
            "https://{}/DefaultCollection/_apis/git/repositories/{}/commits/{}/changes".format(
                instance, repo_id, commit
            )
        )
        changes = resp["changes"]
        return changes

    def get_commit_range(self, instance, repo_id, start_sha, end_sha):
        return self.post(
            "https://{}/DefaultCollection/_apis/git/repositories/{}/commitsBatch".format(
                instance, repo_id
            ),
            data={
                "itemVersion": {"versionType": "commit", "version": start_sha},
                "compareVersion": {"versionType": "commit", "version": end_sha},
            },
        )

    def get_projects(self, instance):
        # TODO(dcramer): VSTS doesn't provide a way to search, so we're
        # making the assumption that a user has 100 or less projects today.
        return self.get(
            "https://{}/DefaultCollection/_apis/projects".format(instance),
            params={"stateFilter": "WellFormed"},
        )
