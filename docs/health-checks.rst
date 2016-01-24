Health Checks
=============

Sentry provides several ways to monitor the system status. This may be as simple
as "is the backend serving requests" to more in-depth and gauging potential
configuration problems. In some cases these checks will be exposed in the UI
though generally only to superusers.

The following endpoint is exposed to aid in automated reporting:

::

    http://sentry.example.com/_health/


Generally this is most useful if you're using it as a health check in something
like HAProxy.

In HAProxy, you could add this to your config:

::

    option httpchk /_health/


That said, we also expose additional checks via the same endpoint by passing
``?full``:

.. code-block:: bash

    $ curl -i http://sentry.example.com/_health/?full
    HTTP/1.0 500 INTERNAL SERVER ERROR
    Content-Type: application/json

    {
      "problems":  [
        "Background workers haven't checked in recently. This can mean an issue
         with your configuration or a serious backlog in tasks."
      ]
    }
