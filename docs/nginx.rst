Deploying Sentry with Nginx
===========================

Nginx provides a very powerful platform for running in front of Sentry as
it gives us features like rate limiting.

If you're on Ubuntu, you can simply install the ``nginx-full`` package
which will include the required RealIP module. Otherwise you'll need to
compile Nginx from source with ``--with-http_realip_module``.

For configuration instructions with regards to incoming mail via nginx see
:ref:`nginx-mail`.

Basic Configuration
-------------------

Below is a sample production ready configuration for Nginx with Sentry::

    http {
      # set REMOTE_ADDR from any internal proxies
      # see http://nginx.org/en/docs/http/ngx_http_realip_module.html
      set_real_ip_from 127.0.0.1;
      set_real_ip_from 10.0.0.0/8;
      real_ip_header X-Forwarded-For;
      real_ip_recursive on;

      # SSL configuration -- change these certs to match yours
      ssl_certificate      /etc/ssl/sentry.example.com.crt;
      ssl_certificate_key  /etc/ssl/sentry.example.com.key;

      # NOTE: These settings may not be the most-current recommended
      # defaults
      ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
      ssl_ciphers ECDH+AESGCM:DH+AESGCM:ECDH+AES256:DH+AES256:ECDH+AES128:DH+AES:ECDH+3DES:DH+3DES:RSA+AESGCM:RSA+AES:RSA+3DES:!aNULL:!MD5:!DSS;
      ssl_prefer_server_ciphers on;
      ssl_session_cache shared:SSL:128m;
      ssl_session_timeout 10m;

      server {
        listen   80;
        server_name sentry.example.com;

        location / {
          if ($request_method = GET) {
            rewrite  ^ https://$host$request_uri? permanent;
          }
          return 405;
        }
      }

      server {
        listen   443 ssl;
        server_name sentry.example.com;

        proxy_set_header   Host                 $http_host;
        proxy_set_header   X-Forwarded-Proto    $scheme;
        proxy_set_header   X-Forwarded-For      $remote_addr;
        proxy_redirect     off;

        # keepalive + raven.js is a disaster
        keepalive_timeout 0;

        # use very aggressive timeouts
        proxy_read_timeout 5s;
        proxy_send_timeout 5s;
        send_timeout 5s;
        resolver_timeout 5s;
        client_body_timeout 5s;

        # buffer larger messages
        client_max_body_size 5m;
        client_body_buffer_size 100k;

        location / {
          proxy_pass        http://localhost:9000;

          add_header Strict-Transport-Security "max-age=31536000";
        }
      }
    }

If you're using SSL, you'll also need to set the following in ``sentry.conf.py``:

.. code-block:: python

    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')


Hosting Sentry at a Subpath
----------------------------

.. Note:: This method is unsupported and untested by the Sentry team.

If your web server is hosting several applications then hosting Sentry at '/' may not be feasible for you. It is possible to configure your webserver such that all traffic going to '/sentry' can be directed at Sentry and everything else can remain as is.


Add the following to your ``SENTRY_WEB_OPTIONS``::

    SENTRY_WEB_OPTIONS = {
      # Host Sentry at /sentry
      'mount': '/sentry=path/to/sentry/wsgi.py'
      'manage-script-name': True
    }

If you call uWSGI directly, possibly from Supervisor, see :ref:`performance-web-server`.

Edit the command used to start sentry by removing this option::

    --wsgi-file getsentry/wsgi.py

And adding these options::

    --mount "/sentry=getsentry/wsgi.py" --manage-script-name

**Nginx Configuration**

Make the adjustment to the 'location' directive in Nginx's configuration file::

    location '/' => location '/sentry'

One rewrite is still required before the location block [#f1]_::

    if ($http_referer ~ .com/sentry) {
      rewrite /sentry/sentry/(.*)$ /sentry/$1 break;
    }


Subpath with Sentry's Default Webserver
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

This is a bit more involved and harder to debug because not only does Nginx have to know the new location to listen for, it also must do rewriting of the urls it sends to the Sentry's built in server because it knows nothing about you trying to host the application elsewhere.

These are not full configurations, but abbreviated versions to highlight the differences from the main examples.

**Nginx Configuration**::

    server {

      ...

      if ($http_referer ~ .com/sentry) {
        rewrite /_static/(.*)$ /sentry/_static/$1 break;
        rewrite /sentry/sentry/(.*)$ /sentry/$1 break;
      }

      location /sentry {
        ...
      }

      ...
    }

**Django Configuration**

Your Sentry settings file ($SENTRY_CONF python file)::

    ...

    FORCE_SCRIPT_NAME = '/sentry'
    ...

.. rubric:: Footnotes

.. [#f1] Some URIs still don't play nice with hosting at a subpath so they need to be caught by Nginx. The known offender is the permalink for all events returned by the API.
