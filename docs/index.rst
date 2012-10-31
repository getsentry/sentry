Sentry
======

Sentry is a realtime event logging and aggregation platform. At its core it
specializes in monitoring errors and extracting all the information needed
to do a proper post-mortem without any of the hassle of the standard user
feedback loop.

Users Guide
-----------

.. toctree::
   :maxdepth: 2

   quickstart/index
   upgrading/index
   config/index
   queue/index
   buffer/index
   udp_server/index
   cli/index
   client/index
   plugins/index

Developers
----------

.. toctree::
   :maxdepth: 2

   developer/client/index
   developer/plugins/index
   developer/interfaces/index

Reference
---------

.. toctree::
   :maxdepth: 1

   contributing/index
   changelog/index
   license/index

Resources
---------

* `Transifex <https://www.transifex.net/projects/p/sentry/>`_ (Translate Sentry!)
* `Bug Tracker <http://github.com/getsentry/sentry/issues>`_
* `Code <http://github.com/getsentry/sentry>`_
* `Mailing List <https://groups.google.com/group/getsentry>`_
* `IRC <irc://irc.freenode.net/sentry>`_  (irc.freenode.net, #sentry)

Screenshots
-----------

Aggregated Events
`````````````````

.. image:: images/group_list.png
   :alt: aggregated events

Event Details
`````````````
.. image:: images/event.png
   :alt: event details

Deprecation Notes
-----------------

Milestones releases are 1.3 or 1.4, and our deprecation policy is to a two version step. For example,
a feature will be deprecated in 1.3, and completely removed in 1.4.
