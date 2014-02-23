Sentry
======

[![Travis   ](https://secure.travis-ci.org/getsentry/sentry.png?branch=master)    ](https://travis-ci.org/getsentry/sentry)
[![Coveralls](https://coveralls.io/repos/getsentry/sentry/badge.png?branch=master)](https://coveralls.io/r/getsentry/sentry?branch=master)
[![BitDeli  ](https://d2weczhvl823v0.cloudfront.net/getsentry/sentry/trend.png)   ](https://bitdeli.com/free)

Sentry is a realtime event logging and aggregation platform. It specializes
in monitoring errors and extracting all the information needed to do a proper
post-mortem without any of the hassle of the standard user feedback loop.

Screenshots
-----------

![group list](docs/images/group_list.png)
![event     ](docs/images/event.png)
![dashboard ](docs/images/dashboard.png)

Sentry is a Server
------------------

The Sentry package, at its core, is just a simple server and web UI. It will
handle authenticating clients (such as [Raven](https://github.com/getsentry/raven-python))
and all of the logic behind storage and aggregation.

That said, Sentry is not limited to Python. The primary implementation is in
Python, but it contains a full API for sending events from any language, in
any application.

Resources
---------

* [Documentation](http://sentry.readthedocs.org)
* [Bug Tracker](http://github.com/getsentry/sentry/issues)
* [Code](http://github.com/getsentry/sentry)
* [Mailing List](https://groups.google.com/group/getsentry)
* [IRC](irc://irc.freenode.net/sentry) (irc.freenode.net, #sentry)
* [Transifex](https://www.transifex.com/projects/p/sentry) (Translate Sentry!)

The [in-development version](http://github.com/getsentry/sentry/tarball/master#egg=sentry-dev)
of Sentry can be installed with `pip install sentry==dev` or `easy_install sentry==dev`.
