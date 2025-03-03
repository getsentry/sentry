FROM python:3.13.1-slim-bookworm

LABEL maintainer="oss@sentry.io"
LABEL org.opencontainers.image.title="Sentry"
LABEL org.opencontainers.image.description="Sentry runtime image"
LABEL org.opencontainers.image.url="https://sentry.io/"
LABEL org.opencontainers.image.documentation="https://develop.sentry.dev/self-hosted/"
LABEL org.opencontainers.image.vendor="Functional Software, Inc."
LABEL org.opencontainers.image.authors="oss@sentry.io"

# add our user and group first to make sure their IDs get assigned consistently
RUN groupadd -r sentry && useradd -r -m -g sentry sentry

RUN : \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        libexpat1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ARG GOSU_VERSION=1.17
ARG GOSU_SHA256=bbc4136d03ab138b1ad66fa4fc051bafc6cc7ffae632b069a53657279a450de3
ARG TINI_VERSION=0.19.0
ARG TINI_SHA256=93dcc18adc78c65a028a84799ecf8ad40c936fdfc5f2a57b1acda5a8117fa82c

RUN set -x \
  && buildDeps=" \
  wget \
  " \
  && apt-get update && apt-get install -y --no-install-recommends $buildDeps \
  && rm -rf /var/lib/apt/lists/* \
  # grab gosu for easy step-down from root
  && wget --quiet -O /usr/local/bin/gosu "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-amd64" \
  && echo "$GOSU_SHA256 /usr/local/bin/gosu" | sha256sum --check --status \
  && chmod +x /usr/local/bin/gosu \
  # grab tini for signal processing and zombie killing
  && wget --quiet -O /usr/local/bin/tini "https://github.com/krallin/tini/releases/download/v$TINI_VERSION/tini-amd64" \
  && echo "$TINI_SHA256 /usr/local/bin/tini" | sha256sum --check --status \
  && chmod +x /usr/local/bin/tini \
  && apt-get purge -y --auto-remove $buildDeps

WORKDIR /usr/src/sentry

ENV PATH=/.venv/bin:$PATH PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python3 -m venv /.venv

ENV \
  # Sentry config params
  SENTRY_CONF=/etc/sentry \
  # UWSGI dogstatsd plugin
  UWSGI_NEED_PLUGIN=/var/lib/uwsgi/dogstatsd \
  # grpcio>1.30.0 requires this, see requirements.txt for more detail.
  GRPC_POLL_STRATEGY=epoll1

# Install dependencies first to leverage Docker layer caching.
COPY requirements-frozen.txt /tmp/requirements-frozen.txt
RUN set -x \
  # uwsgi-dogstatsd
  && buildDeps=" \
  gcc \
  libpcre2-dev \
  wget \
  zlib1g-dev \
  " \
  && apt-get update \
  && apt-get install -y --no-install-recommends $buildDeps \
  && pip install -r /tmp/requirements-frozen.txt \
  && mkdir /tmp/uwsgi-dogstatsd \
  # pinned the same as in getsentry
  && wget -O - https://github.com/DataDog/uwsgi-dogstatsd/archive/1a04f784491ab0270b4e94feb94686b65d8d2db1.tar.gz | \
  tar -xzf - -C /tmp/uwsgi-dogstatsd --strip-components=1 \
  && UWSGI_NEED_PLUGIN="" uwsgi --build-plugin /tmp/uwsgi-dogstatsd \
  && mkdir -p /var/lib/uwsgi \
  && mv dogstatsd_plugin.so /var/lib/uwsgi/ \
  && rm -rf /tmp/requirements-frozen.txt /tmp/uwsgi-dogstatsd .uwsgi_plugins_builder \
  && apt-get purge -y --auto-remove $buildDeps \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  # Fully verify that the C extension is correctly installed, it unfortunately
  # requires a full check into maxminddb.extension.Reader
  && python -c 'import maxminddb.extension; maxminddb.extension.Reader' \
  && mkdir -p $SENTRY_CONF

COPY . .
RUN python3 -m tools.fast_editable --path .
RUN sentry help | sed '1,/Commands:/d' | awk '{print $1}' >  /sentry-commands.txt

COPY ./self-hosted/sentry.conf.py ./self-hosted/config.yml $SENTRY_CONF/
COPY ./self-hosted/docker-entrypoint.sh /

RUN : double-check some built files are available \
    && test -f /usr/src/sentry/src/sentry/loader/_registry.json \
    && test -f /usr/src/sentry/src/sentry/integration-docs/python.json \
    && test -f /usr/src/sentry/src/sentry/static/sentry/dist/entrypoints/app.js \
    && sentry help \
    && :

EXPOSE 9000
VOLUME /data

ENTRYPOINT exec /docker-entrypoint.sh "$0" "$@"
CMD ["run", "web"]

ARG SOURCE_COMMIT
ENV SENTRY_BUILD=${SOURCE_COMMIT:-unknown}
LABEL org.opencontainers.image.revision=$SOURCE_COMMIT
LABEL org.opencontainers.image.source="https://github.com/getsentry/sentry/tree/${SOURCE_COMMIT:-master}/"
LABEL org.opencontainers.image.licenses="https://github.com/getsentry/sentry/blob/${SOURCE_COMMIT:-master}/LICENSE"
