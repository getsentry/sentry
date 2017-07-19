from south.tests import unittest

from south.creator.freezer import model_dependencies
from south.tests.fakeapp import models

class TestFreezer(unittest.TestCase):
    def test_dependencies(self):
        self.assertEqual(set(model_dependencies(models.SubModel)),
                         set([models.BaseModel, models.Other1, models.Other2]))

        self.assertEqual(set(model_dependencies(models.CircularA)),
                         set([models.CircularA, models.CircularB, models.CircularC]))

        self.assertEqual(set(model_dependencies(models.Recursive)),
                         set([models.Recursive]))
