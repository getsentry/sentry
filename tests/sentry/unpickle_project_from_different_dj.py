import pickle

from sentry.testutils import TestCase


class UnpickleProjectFromDifferentDjango(TestCase):
    def test_simple(self):
        for file in [
            "project-1.9-monkey.pickle",
            "project-1.9-nomonkey.pickle",
            "project-1.10-monkey.pickle",
        ]:

            with open(file, "rb") as f:
                unpickled_project = pickle.load(f)

            assert self.project.id == unpickled_project.id
            assert self.project.slug == unpickled_project.slug
            assert self.project.name == unpickled_project.name
            assert self.project.forced_color == unpickled_project.forced_color
            assert self.project.organization == unpickled_project.organization
            assert self.project.teams == unpickled_project.teams
            assert self.project.public == unpickled_project.public
            assert self.project.status == unpickled_project.status
            assert self.project.first_event == unpickled_project.first_event
            assert self.project.flags == unpickled_project.flags
            assert self.project.platform == unpickled_project.platform
            assert self.project.date_added.replace(
                minute=0, second=0, microsecond=0
            ) == unpickled_project.date_added.replace(minute=0, second=0, microsecond=0)
