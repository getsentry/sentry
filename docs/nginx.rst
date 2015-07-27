Deploying Sentry with Nginx
===========================

Nginx provides a very powerful platform for running in front of Sentry as
it gives us features like rate limiting.

If you're on Ubuntu, you can simply install the ``nginx-full`` package
which will include the required RealIP module. Otherwise you'll need to
compile Nginx from source with ``--with-http_realip_module``.

For configuration instructinos with regards to incoming mail via nginx see
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


Proxying uWSGI
--------------

While Sentry provides a default webserver, you'll likely want to move to
something a bit more powerful. We suggest using `uWSGI
<http://projects.unbit.it/uwsgi/>`_ to run Sentry.

Install uWSGI into your virtualenv (refer to quickstart if you're
confused)::

    pip install uwsgi

Create a uWSGI configuration which references the Sentry configuration::

    [uwsgi]
    env = SENTRY_CONF=/etc/sentry.conf.py
    module = sentry.wsgi

    ; spawn the master and 4 processes with 8 threads each
    http = 127.0.0.1:9000
    master = true
    processes = 4
    threads = 8

    ; allow longer headers for raven.js if applicable
    ; default: 4096
    buffer-size = 32768

    ; allow large file uploads
    limit-post = 5242880

    ; various other explicit defaults
    post-buffering = 65536
    thunder-lock = true
    disable-logging = true
    enable-threads = true
    single-interpreter = true
    lazy-apps = true
    log-x-forwarded-for = true


Finally, re-configure supervisor to run uwsgi instead of 'sentry start'::

  /www/sentry/bin/uwsgi --ini /www/sentry/uwsgi.ini
