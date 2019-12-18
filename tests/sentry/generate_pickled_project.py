import pickle

import django

from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class GeneratePickledProject(TestCase):
    def test_simple(self):
        with open("project-" + ".".join(map(str, django.VERSION[:2])) + ".pickle", "wb") as f:
            pickle.dump(self.project, f)
