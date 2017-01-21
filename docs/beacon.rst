Beacon
======

Sentry will periodically communicate with a remote beacon server. This is
utilized for a couple of things, primarily:

- Getting information about the current version of Sentry
- Retrieving important system notices

The remote server is operated by the Sentry team (sentry.io), and the
information reported follows the company's `privacy policy
<https://sentry.io/privacy/>`_.

The following information is reported:

- A unique installation ID
- The version of Sentry
- A technical contact email (``system.admin-email``)
- General anonymous statistics on the data pattern (such as the number of
  users and volume of errors)
- Names and version of the installed Python modules

Note: The contact email is utilized for security announcements, and will
never be used outside of such.

The data reported is minimal and it greatly helps the development team
behind Sentry. With that said, you can disable the beacon with the
following setting:

.. code-block:: python

	SENTRY_BEACON = False
