Testing
=======

Sentry provides a basic py.test-based testing framework for extensions.

.. versionadded:: 7.2.0

In a simple project, you'll need to do a few things to get it working:

setup.py
--------

Augment your setup.py to ensure at least the following:

.. code-block:: python

   setup(
       # ...
      install_requires=[
          'sentry>=7.2.0',
      ]
   )


conftest.py
-----------

The ``conftest.py`` file is our main entry-point for py.test. We need to configure it to load the Sentry pytest configuration:

.. code-block:: python

   from __future__ import absolute_import

   pytest_plugins = [
       'sentry.utils.pytest'
   ]


Test Cases
----------

You can now inherit from Sentry's core test classes. These are Django-based and ensure the database and other basic utilities are in a clean state:

.. code-block:: python

   # test_myextension.py
   from __future__ import absolute_import

   from sentry.testutils import TestCase

   class MyExtensionTest(TestCase):
       def test_simple(self):
          assert 1 != 2


Running Tests
-------------

Running tests follows the py.test standard. As long as your test files and methods are named appropriately (``test_filename.py`` and ``test_function()``) you can simply call out to py.test:

::

    $ py.test -v
    ============================== test session starts ==============================
    platform darwin -- Python 2.7.9 -- py-1.4.26 -- pytest-2.6.4/python2.7
    plugins: django
    collected 1 items

    tests/test_myextension.py::MyExtensionTest::test_simple PASSED

    =========================== 1 passed in 0.35 seconds ============================
