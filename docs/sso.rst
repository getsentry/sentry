Single Sign-On
==============

SSO in Sentry is handled in one of two ways:

- Via a middleware which handles an upstream proxy dictating the authenticated user
- Via a third party service which implements an authentication pipeline

This documentation describes the latter, which would cover things like Google Apps, GitHub,
LDAP, and other similar services.

Enabling SSO
------------

As of version 8.0 the SSO feature is enabled by default in Sentry. That said it can be disabled
with a feature switch in your ``sentry.conf.py``::

    from sentry.conf.server import *

    # turn SSO on our off
    SENTRY_FEATURES['organizations:sso'] = True

You should see an **Auth** subheading under your organization's dashboard when SSO is enabled.

Installing a Provider
---------------------

Providers are installed the same was as extensions. Simply install them via the Python package manager (pip)
and restart the Sentry services. Once done you'll see them show up in the auth settings.

The following providers are published and maintained by the Sentry team:

* `Google Apps <https://github.com/getsentry/sentry-auth-google>`_
* `GitHub <https://github.com/getsentry/sentry-auth-github>`_

