Contributing
============

Want to contribute back to Sentry? This page describes the general development flow,
our philosophy, the test suite, and issue tracking.

(Though it actually doesn't describe all of that, yet)

Coding Standards
----------------

Sentry follows the guidelines layed out in `pep8 <http://www.python.org/dev/peps/pep-0008/>`_  with a little bit
of flexibility on things like line length. We always give way for the `Zen of Python <http://www.python.org/dev/peps/pep-0020/>`_.

Localization
------------

If you're just looking to help translate Sentry, apply for membership via `Transifex <https://www.transifex.com/projects/p/sentry/>`_.

Setting up an Environment
-------------------------

Sentry is designed to run off of setuptools with minimal work. Because of this
setting up a development environment for Sentry requires only a few steps.

Start by installing the required dependencies:

- python-dev
- npm
- virtualenv

One done, create a virtualenv, and bootstrap the environment:

::

    virtualenv ~/.virtualenvs/sentry
    source ~/.virtualenvs/sentry/bin/activate
    make  # bootstrap the environment (npm, pip reqs, etc)

Running the Test Suite
----------------------

The test suite is also powered off of setuptools, and can be run in two fashions. The
easiest is to simply use setuptools and its ``test`` command. This will handle installing
any dependancies you're missing automatically.

::

    python setup.py test

If you've already installed the dependancies, or don't care about certain tests which will
be skipped without them, you can also run tests in a more verbose way.

::

    python runtests.py

The ``runtests.py`` command has several options, and if you're familiar w/ Django you should feel
right at home.

::

    # Stop immediately on a failure
    python runtests.py --failfast

::

    # Run only SentryRemoteTest
    python runtests.py sentry.SentryRemoteTest

::

    # Run only the testTimestamp test on SentryRemoteTest
    python runtests.py sentry.SentryRemoteTest.testTimestamp


Contributing Back Code
----------------------

Ideally all patches should be sent as a pull request on GitHub, and include tests. If you're fixing a bug or making a large change the patch **must** include test coverage.

You can see a list of open pull requests (pending changes) by visiting https://github.com/getsentry/sentry/pulls