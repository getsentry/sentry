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
    sentry_pluginname/plugin.py

The ``__init__.py`` file should contain no plugin logic, and at most, a VERSION = 'x.x.x' line. For example,
if you want to pull the version using pkg_resources (which is what we recommend), your file might contain::

    try:
        VERSION = __import__('pkg_resources') \
            .get_distribution(__name__).version
    except Exception, e:
        VERSION = 'unknown'

Inside of ``plugin.py``, you'll declare your Plugin class::

    import sentry_pluginname
    from sentry.plugins import Plugin

    class PluginName(Plugin):
        title = 'Plugin Name'
        slug = 'pluginname'
        description = 'My awesome plugin!'
        version = sentry_pluginname.VERSION

        author = 'Your Name'
        author_url = 'https://github.com/yourname/sentry_pluginname'

        def widget(self, request, group, **kwargs):
            return "<p>Absolutely useless widget</p>"

And you'll register it via ``entry_points`` in your ``setup.py``::

    setup(
        # ...
        entry_points={
           'sentry.plugins': [
                'pluginname = sentry_pluginname.plugin:PluginName'
            ],
        },
    )

If you're using models or templates, you'll also want to include the ``sentry.apps`` entry point to ensure full
registration of your app::

    setup(
        # ...
        entry_points={
           'sentry.apps': [
                'pluginname = sentry_pluginname'
            ],
        },
    )

That's it! Users will be able to install your plugin via ``pip install <package name>`` and configure it
via the web interface based on the hooks you enable.

Next Steps
----------

Dig into the rest of the plugin documentation, and take a look at existing plugins for ideas/best practices.

.. toctree::
   :maxdepth: 2

   interface
   permissions

More and better docs coming soon..