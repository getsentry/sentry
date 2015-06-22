Sentry
======

Sentry is a modern error logging and aggregation platform.


Sentry is a Server
------------------

The Sentry package fundamentally is just a simple server and web UI. It will
handle authenticating clients (such as `Raven <https://github.com/getsentry/raven-python>`_)
and all of the logic behind storage and aggregation.

That said, Sentry is not limited to Python. The primary implementation is in
Python, but it contains a full API for sending events from any language, in
any application.


Resources
---------

* `Documentation <http://sentry.readthedocs.org/>`_
* `Bug Tracker <http://github.com/getsentry/sentry/issues>`_
* `Code <http://github.com/getsentry/sentry>`_
* `Ask on Stack Overflow <http://stackoverflow.com/questions/ask?tags=sentry>`_
* `Mailing List <https://groups.google.com/group/getsentry>`_
* `IRC <irc://irc.freenode.net/sentry>`_  (irc.freenode.net, #sentry)
* `Transifex <https://www.transifex.com/projects/p/sentry/>`_ (Translate Sentry!)


Screenshots
-----------

These screenshots may be slightly outdated, but should give you a feel for what Sentry presents.

.. image:: https://github.com/getsentry/sentry/raw/master/docs/images/group_list.png

.. image:: https://github.com/getsentry/sentry/raw/master/docs/images/event.png

.. image:: https://github.com/getsentry/sentry/raw/master/docs/images/dashboard.png
