Sentry
======

.. image:: https://secure.travis-ci.org/dcramer/sentry.png?branch=master
   :target: http://travis-ci.org/dcramer/sentry


Sentry is a realtime event logging and aggregation platform. It specializes
in monitoring errors and extracting all the information needed to do a proper
post-mortem without any of the hassle of the standard user feedback loop.

Screenshots
-----------

.. image:: https://github.com/dcramer/sentry/raw/master/docs/images/group_list.png

.. image:: https://github.com/dcramer/sentry/raw/master/docs/images/event.png

Sentry is a Server
------------------

The Sentry package, at its core, is just a simple server and web UI. It will
handle authenticating clients (such as `Raven <https://github.com/dcramer/raven>`_)
and all of the logic behind storage and aggregation.

That said, Sentry is not limited to Python. The primary implementation is in
Python, but it contains a full API for sending events from any language, in
any application.

Resources
---------

* `Documentation <http://sentry.readthedocs.org/>`_
* `Bug Tracker <http://github.com/dcramer/sentry/issues>`_
* `Code <http://github.com/dcramer/sentry>`_
* `Mailing List <https://groups.google.com/group/getsentry>`_
* `IRC <irc://irc.freenode.net/sentry>`_  (irc.freenode.net, #sentry)
