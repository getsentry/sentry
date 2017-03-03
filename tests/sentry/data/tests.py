# -*- coding: utf-8 -*-

from __future__ import absolute_import

import os
import six

from sentry.constants import DATA_ROOT
from sentry.testutils import TestCase
from sentry.utils import json


class DataGenerator(type):
    def __new__(cls, name, bases, attrs):
        root = os.path.join(DATA_ROOT, 'samples')
        for filename in os.listdir(root):
            if not filename.endswith('.json'):
                continue

            func_name = 'test_%s_sample_is_valid_json' % (filename[:-4].replace('.', '_'))

            def test_func(self):
                with open(os.path.join(root, filename)) as fp:
                    json.loads(fp.read())
            test_func.__name__ = func_name
            attrs[func_name] = test_func
        return super(DataGenerator, cls).__new__(cls, name, bases, attrs)


@six.add_metaclass(DataGenerator)
class DataTestCase(TestCase):
    pass
