Contributing
============

Want to contribute back to Sentry? This page describes the general development flow,
our philosophy, the test suite, and issue tracking.

(Though it actually doesn't describe all of that, yet)

Setting up an Environment
-------------------------

Sentry is designed to run off of setuptools with minimal work. Because of this
setting up a development environment for Sentry requires only a few steps.

The first thing you're going to want to do, is build a virtualenv and install
any base dependancies.

::

    virtualenv ~/.virtualenvs/sentry
    source ~/.virtualenvs/sentry/bin/activate
    python setup.py develop

There are other optional dependancies, such as South, Haystack, and Eventlet, but
they're not required to get a basic stack up and running.

Running the Test Suite
----------------------

The test suite is also powered off of setuptools, and can be run in two fashions. The
easiest is to simply use setuptools and it's ``test`` command. This will handle installing
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