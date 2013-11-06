Utilizing the UDP Server
========================

.. note:: The UDP server has many limitations, and is unsupported for general Sentry usage.

The UDP server requires the `eventlet`_ module.

.. _eventlet: http://eventlet.net/

::

    pip install eventlet

To start the server:

::

    sentry start udp


Configuration
-------------

See the section on :ref:`UDP server settings <config-udp-server>`.
