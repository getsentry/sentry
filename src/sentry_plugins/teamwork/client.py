from __future__ import absolute_import

from sentry import http
from sentry.utils import json


class TeamworkClient(object):
    def __init__(self, base_url, token, timeout=5):
        self.base_url = base_url
        self._token = token
        self._timeout = timeout

    def _request(self, path, method="GET", params=None, data=None):
        path = path.lstrip("/")
        url = "%s/%s" % (self.base_url, path)

        if not params:
            params = {}

        session = http.build_session()
        resp = getattr(session, method.lower())(
            url, auth=(self._token, ""), params=params, json=data, timeout=self._timeout
        )
        resp.raise_for_status()
        return json.loads(resp.content)

    def list_projects(self):
        return self._request(path="/projects.json")["projects"]

    def list_tasklists(self, project_id):
        return self._request(path="/projects/{0}/tasklists.json".format(project_id))["tasklists"]

    def create_task(self, tasklist_id, **kwargs):
        return self._request(
            method="POST",
            path="/tasklists/{0}/tasks.json".format(tasklist_id),
            data={"todo-item": kwargs},
        )["id"]
