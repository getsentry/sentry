Beacon
======

Sentry will periodically communicate with a remote beacon server. This is
utilized for a couple of things, primarily:

- Getting information about the current version of Sentry
- Retrieving important system notices

The remote server is operated by the Sentry team (getsentry.com), and the
information reported follows the company's `privacy policy
<https://www.getsentry.com/privacy/>`_.

The following information is reported:

- A unique installation ID
- The version of Sentry
- A technical contact email (``SENTRY_ADMIN_EMAIL``)
- General anonymous statistics on the data pattern (such as the number of
  users)

Note: The contact email is utilized for security announcements, and will
never be used outside of such.

The data reported is minimal and it greatly helps the development team
behind Sentry. With that said, you can disable the beacon with the
following setting::

	SENTRY_BEACON = False
