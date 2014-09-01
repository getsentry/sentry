System Options
==============

System configuration is handled at two stages:

- In the ``sentry_options`` table.
- In Sentry configuration (Django settings via SENTRY_OPTIONS).

The options package should be the primary point of configuration outside of
critical systems (such as database connection information).

:mod:`sentry.options`
---------------------

The options manager is exported as ``sentry.options.default_manager`` and
the public API is also exposed at options module level:

.. code:: python

    from sentry import options

    if options.get('foo') == 'bar':
       print('foo is set to bar')


.. autoclass:: sentry.options.manager.OptionsManager
   :members:
