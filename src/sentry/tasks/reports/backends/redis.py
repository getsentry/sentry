from __future__ import annotations

import zlib
from typing import Any, Sequence

from sentry.models import Organization, Project
from sentry.utils import json
from sentry.utils.compat import map

from .base import ReportBackend


class RedisReportBackend(ReportBackend):
    version = 1

    def __init__(self, cluster, ttl, namespace: str = "r") -> None:
        self.cluster = cluster
        self.ttl = ttl
        self.namespace = namespace

    def __make_key(self, timestamp: float, duration: float, organization: Organization) -> str:
        return "{}:{}:{}:{}:{}".format(
            self.namespace, self.version, organization.id, int(timestamp), int(duration)
        )

    def __encode(self, report):
        return zlib.compress(json.dumps(list(report)).encode("utf-8"))

    def __decode(self, value):
        if value is None:
            return None

        from sentry.tasks.reports import Report

        return Report(*json.loads(zlib.decompress(value)))

    def prepare(self, timestamp: float, duration: float, organization: Organization) -> None:
        reports = {}
        for project in organization.project_set.all():
            reports[project.id] = self.__encode(self.build(timestamp, duration, project))

        if not reports:
            # XXX: HMSET requires at least one key/value pair, so we need to
            # protect ourselves here against organizations that were created
            # but haven't set up any projects yet.
            return None

        with self.cluster.map() as client:
            key = self.__make_key(timestamp, duration, organization)
            client.hmset(key, reports)
            client.expire(key, self.ttl)

    def fetch(
        self,
        timestamp: float,
        duration: float,
        organization: Organization,
        projects: Sequence[Project],
    ) -> Sequence[Any]:
        with self.cluster.map() as client:
            result = client.hmget(
                self.__make_key(timestamp, duration, organization),
                [project.id for project in projects],
            )

        return map(self.__decode, result.value)
