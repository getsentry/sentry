Writing a Plugin
================

**The plugin interface is a work in progress.**

Several interfaces exist for extending Sentry:

* Event Filters (sentry.filters)
* Data Interfaces (sentry.interfaces)
* Aggregate Views (sentry.views)
* Plugins (sentry.plugins)

Until we get sample docs up, it's suggested that you review the builtin plugins
and the base classes to understand how the system works.

One thing to note, is that all extended methods (outside of data interfaces) should
accept ``**kwargs`` to handle future changes.


.. toctree::
   :maxdepth: 2

   interface
   permissions

More and better docs coming soon..