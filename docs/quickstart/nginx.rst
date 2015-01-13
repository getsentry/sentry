Configuring Sentry with Nginx
=============================


Nginx provides a very powerful platform for running in front of Sentry as it
gives us features like rate limiting.

If you're on Ubuntu, you can simply install the ``nginx-full`` package which will include the required RealIP module. Otherwise you'll need to compile Nginx from source with ``--with-http_realip_module``.

Below is a sample production ready configuration for Nginx with Sentry:

::

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
        client_max_body_size 150k;
        client_body_buffer_size 150k;

        location / {
          proxy_pass        http://localhost:9000;

          add_header Strict-Transport-Security "max-age=31536000";
        }
      }
    }


Proxying uWSGI
~~~~~~~~~~~~~~

You may optionally want to setup `uWSGI <http://projects.unbit.it/uwsgi/>`_ to
run Sentry (rather than relying on the built-in gunicorn webserver).

Within your uWSGI configuration, you'll need to export your configuration path
as well the ``sentry.wsgi`` module:

::

    [uwsgi]
    env = SENTRY_CONF=/etc/sentry.conf.py
    module = sentry.wsgi

    ; spawn the master and 4 processes
    http-socket = :9000
    master = true
    processes = 4

    ; allow longer headers for raven.js if applicable
    ; default: 4096
    buffer-size = 32768


Proxying Incoming Email
~~~~~~~~~~~~~~~~~~~~~~~

Nginx is recommended for handling incoming emails in front of the Sentry smtp server.

Below is a sample configuration for Nginx:

::

    http {
      # Bind an http server to localhost only just for the smtp auth
      server {
        listen 127.0.0.1:80;

        # Return back the address and port for the listening
        # Sentry smtp server. Default is 127.0.0.1:1025.
        location = /smtp {
          add_header Auth-Server 127.0.0.1;
          add_header Auth-Port   1025;
          return 200;
        }
      }
    }

    mail {
      auth_http localhost/smtp;

      server {
        listen 25;

        protocol   smtp;
        proxy      on;
        smtp_auth  none;
        xclient    off;
      }
    }
