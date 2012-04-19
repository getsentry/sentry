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

Structure
---------

A plugins layout generally looks like the following::

    setup.py
    sentry_pluginname/
    sentry_pluginname/__init__.py
    sentry_pluginname/models.py

The ``__init__.py`` file should contain no plugin logic, and at most, a VERSION = 'x.x.x' line. For example,
if you want to pull the version using pkg_resources (which is what we recommend), your file might contain::

    try:
        VERSION = __import__('pkg_resources') \
            .get_distribution(__name__).version
    except Exception, e:
        VERSION = 'unknown'

Inside of ``models.py``, you'll declare your Plugin class, and register it::

    import sentry_pluginname
    from sentry.plugins import Plugin, register

    @register
    class PluginName(Plugin):
        title = 'Plugin Name'
        slug = 'pluginname'
        description = 'My awesome plugin!'
        version = sentry_pluginname.VERSION

        author = 'Your Name'
        author_url = 'https://github.com/yourname/sentry_pluginname'

        def widget(self, request, group, **kwargs):
            return "<p>Absolutely useless widget</p>"

Next Steps
----------

Dig into the rest of the plugin documentation, and take a look at existing plugins for ideas/best practices.

.. toctree::
   :maxdepth: 2

   interface
   permissions

More and better docs coming soon..