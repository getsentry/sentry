from __future__ import print_function

#import unittest
import os
import sys
from functools import wraps
from django.conf import settings
from south.hacks import hacks

# Make sure skipping tests is available.
try:
    # easiest and best is unittest included in Django>=1.3
    from django.utils import unittest
except ImportError:
    # earlier django... use unittest from stdlib
    import unittest
# however, skipUnless was only added in Python 2.7;
# if not available, we need to do something else
try:
    skipUnless = unittest.skipUnless #@UnusedVariable
except AttributeError:
    def skipUnless(condition, message):
        def decorator(testfunc):
            @wraps(testfunc)
            def wrapper(self):
                if condition:
                    # Apply method
                    testfunc(self)
                else:
                    # The skip exceptions are not available either...
                    print("Skipping", testfunc.__name__,"--", message)
            return wrapper
        return decorator

# ditto for skipIf
try:
    skipIf = unittest.skipIf #@UnusedVariable
except AttributeError:
    def skipIf(condition, message):
        def decorator(testfunc):
            @wraps(testfunc)
            def wrapper(self):
                if condition:
                    print("Skipping", testfunc.__name__,"--", message)
                else:
                    # Apply method
                    testfunc(self)
            return wrapper
        return decorator

# Add the tests directory so fakeapp is on sys.path
test_root = os.path.dirname(__file__)
sys.path.append(test_root)

# Note: the individual test files are imported below this.

class Monkeypatcher(unittest.TestCase):

    """
    Base test class for tests that play with the INSTALLED_APPS setting at runtime.
    """

    def create_fake_app(self, name):
        
        class Fake:
            pass
        
        fake = Fake()
        fake.__name__ = name
        try:
            fake.migrations = __import__(name + ".migrations", {}, {}, ['migrations'])
        except ImportError:
            pass
        return fake

    def setUp(self):
        """
        Changes the Django environment so we can run tests against our test apps.
        """
        if hasattr(self, 'installed_apps'):
            hacks.store_app_cache_state()
            hacks.set_installed_apps(self.installed_apps)
            # Make sure dependencies are calculated for new apps
            Migrations._dependencies_done = False

    def tearDown(self):
        """
        Undoes what setUp did.
        """
        if hasattr(self, 'installed_apps'):
            hacks.reset_installed_apps()
            hacks.restore_app_cache_state()


# Try importing all tests if asked for (then we can run 'em)
try:
    skiptest = settings.SKIP_SOUTH_TESTS
except:
    skiptest = True

if not skiptest:
    from south.tests.db import *
    from south.tests.db_mysql import *
    from south.tests.db_firebird import *
    from south.tests.logic import *
    from south.tests.autodetection import *
    from south.tests.logger import *
    from south.tests.inspector import *
    from south.tests.freezer import *
