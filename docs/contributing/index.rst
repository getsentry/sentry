Contributing
============

Want to contribute back to Sentry? This page describes the general development flow,
our philosophy, the test suite, and issue tracking.


Documentation
-------------

If you're looking to help document Sentry, you can get set up with Sphinx, our documentation tool,
but first you will want to make sure you have a few things on your local system:

* python-dev (if you're on OS X, you already have this)
* pip
* virtualenvwrapper

Once you've got all that, the rest is simple:

::

    # If you have a fork, you'll want to clone it instead
    git clone git://github.com/getsentry/sentry.git

    # Create a python virtualenv
    mkvirtualenv sentry

    # Make the magic happen
    make dev-docs

Running ``make dev-docs`` will install the basic requirements to get Sphinx running.


Building Documentation
~~~~~~~~~~~~~~~~~~~~~~

Inside the ``docs`` directory, you can run ``make`` to build the documentation.  
See ``make help`` for available options and the `Sphinx Documentation <http://sphinx-doc.org/contents.html>`_ for more information.


Localization
------------

If you're just looking to help translate Sentry, apply for membership via `Transifex <https://www.transifex.com/projects/p/sentry/>`_.


Developing Against HEAD
-----------------------

We try to make it easy to get up and running in a development environment using a git checkout
of Sentry. You'll want to make sure you have a few things on your local system first:

* python-dev (if you're on OS X, you already have this)
* pip
* virtualenv (ideally virtualenvwrapper)
* node.js (for npm and building css/javascript)
* (Optional) Redis
* (Optional) Potgresql

Once you've got all that, the rest is simple:

::

    # If you have a fork, you'll want to clone it instead
    git clone git://github.com/getsentry/sentry.git

    # Create a python virtualenv
    mkvirtualenv sentry

    # Make the magic happen
    make

Running ``make`` will do several things, including:

* Setting up any submodules (including Bootstrap)
* Installing Python requirements
* Installing NPM requirements

.. note::
    You will want to store your virtualenv out of the ``sentry`` directory you cloned above,
    otherwise ``make`` will fail.

Create a default Sentry configation just as if this were a production instance:

::

    sentry init

You'll likely want to make some changes to the default configuration (we recommend developing against Postgres, for example). Once done, migrate your database using the following command:

::

	sentry upgrade


.. note:: The ``upgrade`` shortcut is simply a combination of South's migrate, and Django's syncdb commands.


Coding Standards
----------------

Sentry follows the guidelines laid out in `pep8 <http://www.python.org/dev/peps/pep-0008/>`_  with a little bit
of flexibility on things like line length. We always give way for the `Zen of Python <http://www.python.org/dev/peps/pep-0020/>`_. We also use strict mode for JavaScript, enforced by jshint.

You can run all linters with ``make lint``, or respectively ``lint-python`` or ``lint-js``.


Running the Test Suite
----------------------

The test suite consists of multiple parts, testing both the Python and JavaScript components in Sentry. If you've setup your environment correctly, you can run the entire suite with the following command:

::

    make test

If you only need to run the Python tests, you can do so with ``make test-python``, as well as ``test-js`` for the JavaScript tests.


You'll notice that the test suite is structured based on where the code lives, and strongly encourages using the mock library to drive more accurate individual tests.

.. note:: We use py.test for the Python test suite, and a combination of phantomjs and jasmine for the JavaScript tests.


Static Media
------------

Sentry uses a library that compiles it's static media assets (LESS and JS files) automatically. If you're developing using
runserver you'll see changes happen not only in the original files, but also the minified or processed versions of the file.

If you've made changes and need to compile them by hand for any reason, you can do so by running:

::

    sentry compilestatic

The minified and processed files should be committed alongside the unprocessed changes.

Developing with Django
----------------------

Because Sentry is just Django, you can use all of the standard Django functionality. The only difference is you'll be accessing commands that would normally go through manage.py using the ``sentry`` CLI helper instead.

For example, you probably don't want to use ``sentry start`` for development, as it doesn't support anything like
automatic reloading on code changes. For that you'd want to use the standard builtin ``runserver`` command:

::

	sentry runserver


Contributing Back Code
----------------------

All patches should be sent as a pull request on GitHub, include tests, and documentation where needed. If you're fixing a bug or making a large change the patch **must** include test coverage.

Uncertain about how to write tests? Take a look at some existing tests that are similar to the code you're changing, and go from there.

You can see a list of open pull requests (pending changes) by visiting https://github.com/getsentry/sentry/pulls
