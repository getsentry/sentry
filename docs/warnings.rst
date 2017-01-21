System Warnings
===============

Deprecated Settings
-------------------

Beginning with Sentry 8.0 configuration settings have started migrating from
the original ``sentry.conf.py`` over into a new format ``config.yml``. We refer
to the new format as ``SENTRY_OPTIONS``.

For example, ``SENTRY_OPTIONS["system.admin-email"]`` means, put
``system.admin-email`` into ``config.yml``.

In Sentry 8.3, we have begun deprecating some settings from the old ``sentry.conf.py``
and will soon be only accepting the new values from the new ``config.yml`` file.

Historically, ``SENTRY_CONF`` or ``--config`` was pointed directly to your
``sentry.conf.py``, such as::

    $ SENTRY_CONF=/etc/sentry/sentry.conf.py sentry start

Now, ``SENTRY_CONF`` should be pointed to the parent directory that contains both
the python file and the yaml file. ``sentry init`` will generate the right
structure needed for the future.::

    $ SENTRY_CONF=/etc/sentry sentry run web

The following will be a simple mapping of old (``sentry.conf.py``) keys to new
(``config.yml``). Old settings should be completely removed.

General
~~~~~~~

.. describe:: SENTRY_ADMIN_EMAIL

    ::

        system.admin-email: 'sentry@example.com'

.. describe:: SENTRY_URL_PREFIX

    ::

        system.url-prefix: 'http://example.com'

.. describe:: SENTRY_SYSTEM_MAX_EVENTS_PER_MINUTE

    ::

        system.rate-limit: 10

.. describe:: SECRET_KEY

    ::

        system.secret-key: 'abc123'


Mail
~~~~

.. describe:: EMAIL_BACKEND

    ::

        mail.backend: 'smtp'


.. describe:: EMAIL_HOST

    ::

        mail.host: 'localhost'

.. describe:: EMAIL_PORT

    ::

        mail.port: 25

.. describe:: EMAIL_HOST_USER

    ::

        mail.username: 'sentry'

.. describe:: EMAIL_HOST_PASSWORD

    ::

        mail.password: 'nobodywillguessthisone'

.. describe:: EMAIL_USE_TLS

    ::

        mail.use-tls: true

.. describe:: SERVER_EMAIL

    ::

        mail.from: 'sentry@example.com'

.. describe:: EMAIL_SUBJECT_PREFIX

    ::

        mail.subject-prefix: '[Sentry] '

.. describe:: SENTRY_ENABLE_EMAIL_REPLIES

    ::

        mail.enable-replies: true

.. describe:: SENTRY_SMTP_HOSTNAME

    ::

        mail.reply-hostname: 'inbound.example.com'

.. describe:: MAILGUN_API_KEY

    ::

        mail.mailgun-api-key: 'abc123'


Redis
~~~~~

.. describe:: SENTRY_REDIS_OPTIONS

    ::

        redis.clusters:
          default:  # cluster name; `default` replaces `SENTRY_REDIS_OPTIONS`
            hosts:  # options are passed as keyword arguments to `rb.Cluster`
              0:
                host: redis-1.example.com
                port: 6379
              1:
                host: redis-2.example.com
                port: 6379
