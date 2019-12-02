from __future__ import absolute_import

from sentry import http
from sentry.utils import json


class RedmineClient(object):
    def __init__(self, host, key):
        self.host = host.rstrip("/")
        self.key = key

    def request(self, method, path, data=None):
        headers = {"X-Redmine-API-Key": self.key, "Content-Type": "application/json"}
        url = "{}{}".format(self.host, path)
        session = http.build_session()
        req = getattr(session, method.lower())(url, json=data, headers=headers)
        return json.loads(req.text)

    def get_projects(self):
        limit = 100
        projects = []

        def get_response(limit, offset):
            return self.request("GET", "/projects.json?limit=%s&offset=%s" % (limit, offset))

        response = get_response(limit, 0)

        while len(response["projects"]):
            projects.extend(response["projects"])
            response = get_response(limit, response["offset"] + response["limit"])

        return {"projects": projects}

    def get_trackers(self):
        response = self.request("GET", "/trackers.json")
        return response

    def get_priorities(self):
        response = self.request("GET", "/enumerations/issue_priorities.json")
        return response

    def create_issue(self, data):
        response = self.request("POST", "/issues.json", data={"issue": data})

        if "issue" not in response or "id" not in response["issue"]:
            raise Exception("Unable to create redmine ticket")

        return response
