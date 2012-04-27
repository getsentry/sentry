Utilizing the UDP Server
========================

The UDP server requires the :mod:`eventlet` module.

::

    pip install eventlet

To start the server:

::

    sentry start udp


Configuration
-------------

There are a few settings that you can tweak::

    SENTRY_UDP_HOST = '0.0.0.0'
    SENTRY_UDP_PORT = 9001
