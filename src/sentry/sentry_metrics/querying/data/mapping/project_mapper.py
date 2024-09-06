from collections.abc import Sequence

from sentry.models.project import Project
from sentry.sentry_metrics.querying.data.mapping.base import Mapper


class Project2ProjectIDMapper(Mapper):
    from_key: str = "project"
    to_key: str = "project_id"

    def __init__(self):
        super().__init__()

    def forward(self, projects: Sequence[Project], value: str) -> int:
        if value not in self.map:
            # if the project cannot be found, set the project_id to 0 so that it is passed to Snuba and returns empty
            # results as usual, as opposed to throwing an error.
            self.map[value] = 0
            for project in projects:
                if project.slug == value:
                    self.map[value] = project.id
        return self.map[value]

    def backward(self, projects: Sequence[Project], value: int) -> str:
        if value not in self.map:
            for project in projects:
                if project.id == value:
                    self.map[value] = project.slug

        return self.map[value]
