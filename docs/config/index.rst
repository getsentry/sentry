Configuration
=============

This document describes additional configuration options available to the Sentry server. If you are looking for documentation for the client, it is maintained in the `Raven <http://github.com/getsentry/raven-python>`_ project.

.. data:: SENTRY_URL_PREFIX
    :noindex:

	Absolute URL to the sentry root directory. Should not include a trailing slash.

	Defaults to ``""``.

	::

		SENTRY_URL_PREFIX = 'http://sentry.example.com'


Authentication
--------------


.. data:: SENTRY_ALLOW_REGISTRATION
    :noindex:

    Should Sentry allow users to create new accounts?

    Defaults to ``True`` (can register).

    ::

        SENTRY_ALLOW_REGISTRATION = False

.. data:: SENTRY_PUBLIC
    :noindex:

    Should Sentry make all data publicly accessible? This should **only** be
    used if you're installing Sentry behind your company's firewall.

    Users will still need to have an account to view any data.

    Defaults to ``False``.

    ::

        SENTRY_PUBLIC = True

.. data:: SENTRY_ALLOW_PROJECT_CREATION
    :noindex:

    Should Sentry allow users without the 'sentry.add_project' permission to
    create new projects?

    Defaults to ``False`` (require permission).

    ::

        SENTRY_ALLOW_PROJECT_CREATION = True

.. data:: SENTRY_ALLOW_TEAM_CREATION
    :noindex:

    Should Sentry allow users without the 'sentry.add_team' permission to
    create new teams?

    Defaults to ``True`` (require permission).

    ::

        SENTRY_ALLOW_TEAM_CREATION = False

.. data:: SENTRY_ALLOW_PUBLIC_PROJECTS
    :noindex:

    Should Sentry allow users without the 'sentry.change_project' permission to
    make projects globally public?

    Defaults to ``True`` (can set public status).

    ::

        SENTRY_ALLOW_PUBLIC_PROJECTS = False


.. data:: SENTRY_ALLOW_ORIGIN
    :noindex:

    If provided, Sentry will set the Access-Control-Allow-Origin header to this
    value on /api/store/ responses. In addition, the
    Access-Control-Allow-Headers header will be set to 'X-Sentry-Auth'. This
    allows JavaScript clients to submit cross-domain error reports.

    You can read more about these headers in the `Mozilla developer docs`_.

    Defaults to ``None`` (don't add the Access-Control headers)

    ::

        SENTRY_ALLOW_ORIGIN = "http://foo.example"

.. _Mozilla developer docs: https://developer.mozilla.org/En/HTTP_access_control#Simple_requests


Services
--------

Web Server
~~~~~~~~~~

The following settings are available for the built-in webserver:

.. data:: SENTRY_WEB_HOST
    :noindex:

    The hostname which the webserver should bind to.

    Defaults to ``localhost``.

    ::

        SENTRY_WEB_HOST = '0.0.0.0'  # bind to all addresses

.. data:: SENTRY_WEB_PORT
    :noindex:

    The port which the webserver should listen on.

    Defaults to ``9000``.

    ::

        SENTRY_WEB_PORT = 9000


.. data:: SENTRY_WEB_OPTIONS
    :noindex:

    A dictionary of additional configuration options to pass to gunicorn.

    Defaults to ``{}``.

    ::

        SENTRY_WEB_OPTIONS = {
            'workers': 10,
            'worker_class': 'gevent',
        }


.. _config-udp-server:

UDP Server
~~~~~~~~~~

The following settings are available for the built-in UDP API server:

.. data:: SENTRY_UDP_HOST
    :noindex:

    The hostname which the udp server should bind to.

    Defaults to ``localhost``.

    ::

        SENTRY_UDP_HOST = '0.0.0.0'  # bind to all addresses

.. data:: SENTRY_UDP_PORT
    :noindex:

    The port which the udp server should listen on.

    Defaults to ``9001``.

    ::

        SENTRY_UDP_PORT = 9001


Data Sampling
-------------

.. data:: SENTRY_SAMPLE_DATA
    :noindex:

    .. versionadded:: 1.10.0

    Controls sampling of data.

    Defaults to ``True``.

    If this is enabled, data will be sampled in a manner similar to the following:

    * 50 messages stores ~50 results
    * 1000 messages stores ~400 results
    * 10000 messages stores ~900 results
    * 100000 messages stores ~1800 results
    * 1000000 messages stores ~3600 results
    * 10000000 messages stores ~4500 results

    ::

        SENTRY_SAMPLE_DATA = False
