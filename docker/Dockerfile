ARG PY_VER=2.7.16
FROM python:${PY_VER}-slim-buster

LABEL maintainer="oss@sentry.io"
LABEL org.opencontainers.image.title="Sentry"
LABEL org.opencontainers.image.description="Sentry runtime image"
LABEL org.opencontainers.image.url="https://sentry.io/"
LABEL org.opencontainers.image.documentation="https://develop.sentry.dev/self-hosted/"
LABEL org.opencontainers.image.vendor="Functional Software, Inc."
LABEL org.opencontainers.image.authors="oss@sentry.io"

# add our user and group first to make sure their IDs get assigned consistently
RUN groupadd -r sentry && useradd -r -m -g sentry sentry

ENV GOSU_VERSION=1.11 \
  TINI_VERSION=0.18.0

RUN set -x \
  && buildDeps=" \
  dirmngr \
  gnupg \
  wget \
  " \
  && apt-get update && apt-get install -y --no-install-recommends $buildDeps \
  && rm -rf /var/lib/apt/lists/* \
  # Fetch trusted keys
  && for key in \
  # gosu
  B42F6819007F00F88E364FD4036A9C25BF357DD4 \
  # tini
  595E85A6B1B4779EA4DAAEC70B588DFF0527A9B7 \
  ; do \
  # TODO(byk): Replace the keyserver below w/ something owned by Sentry
  gpg --batch --keyserver hkps://mattrobenolt-keyserver.global.ssl.fastly.net:443 --recv-keys "$key"; \
  done \
  # grab gosu for easy step-down from root
  && wget -O /usr/local/bin/gosu "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-$(dpkg --print-architecture)" \
  && wget -O /usr/local/bin/gosu.asc "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-$(dpkg --print-architecture).asc" \
  && gpg --batch --verify /usr/local/bin/gosu.asc /usr/local/bin/gosu \
  && rm -r /usr/local/bin/gosu.asc \
  && chmod +x /usr/local/bin/gosu \
  # grab tini for signal processing and zombie killing
  && wget -O /usr/local/bin/tini "https://github.com/krallin/tini/releases/download/v$TINI_VERSION/tini" \
  && wget -O /usr/local/bin/tini.asc "https://github.com/krallin/tini/releases/download/v$TINI_VERSION/tini.asc" \
  && gpg --batch --verify /usr/local/bin/tini.asc /usr/local/bin/tini \
  && rm /usr/local/bin/tini.asc \
  && chmod +x /usr/local/bin/tini \
  && apt-get purge -y --auto-remove $buildDeps

# Sane defaults for pip
ENV PIP_NO_CACHE_DIR=off \
  PIP_DISABLE_PIP_VERSION_CHECK=1 \
  # Sentry config params
  SENTRY_CONF=/etc/sentry \
  # Disable some unused uWSGI features, saving dependencies
  # Thank to https://stackoverflow.com/a/25260588/90297
  UWSGI_PROFILE_OVERRIDE=ssl=false;xml=false;routing=false \
  # UWSGI dogstatsd plugin
  UWSGI_NEED_PLUGIN=/var/lib/uwsgi/dogstatsd

# Copy and install dependencies first to leverage Docker layer caching.
COPY /dist/requirements.txt /tmp/dist/requirements.txt
RUN set -x \
  && buildDeps="" \
  # uwsgi
  && buildDeps="$buildDeps \
  gcc \
  g++ \
  wget \
  " \
  # maxminddb
  && buildDeps="$buildDeps \
  libmaxminddb-dev \
  "\
  # xmlsec
  && buildDeps="$buildDeps \
  libxmlsec1-dev \
  pkg-config \
  " \
  && apt-get update \
  && apt-get install -y --no-install-recommends $buildDeps \
  && python -m pip install --upgrade 'pip>=20.2.0' \
  && pip install -r /tmp/dist/requirements.txt \
  && mkdir /tmp/uwsgi-dogstatsd \
  && wget -O - https://github.com/eventbrite/uwsgi-dogstatsd/archive/filters-and-tags.tar.gz | \
  tar -xzf - -C /tmp/uwsgi-dogstatsd --strip-components=1 \
  && UWSGI_NEED_PLUGIN="" uwsgi --build-plugin /tmp/uwsgi-dogstatsd \
  && mkdir -p /var/lib/uwsgi \
  && mv dogstatsd_plugin.so /var/lib/uwsgi/ \
  && rm -rf /tmp/dist /tmp/uwsgi-dogstatsd .uwsgi_plugins_builder \
  && apt-get purge -y --auto-remove $buildDeps \
  # We install run-time dependencies strictly after
  # build dependencies to prevent accidental collusion.
  # These are also installed last as they are needed
  # during container run and can have the same deps w/
  # build deps such as maxminddb.
  && apt-get install -y --no-install-recommends \
  # pillow
  libjpeg-dev \
  # rust bindings
  libffi-dev \
  # maxminddb bindings
  libmaxminddb-dev \
  # SAML needs these run-time
  libxmlsec1-dev \
  libxslt-dev \
  # pyyaml needs this run-time
  libyaml-dev \
  # other
  pkg-config \
  \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  # Fully verify that the C extension is correctly installed, it unfortunately
  # requires a full check into maxminddb.extension.Reader
  && python -c 'import maxminddb.extension; maxminddb.extension.Reader' \
  && mkdir -p $SENTRY_CONF

COPY /dist/*.whl /tmp/dist/
RUN pip install /tmp/dist/*.whl --use-feature=2020-resolver && pip check && rm -rf /tmp/dist
RUN sentry help | sed '1,/Commands:/d' | awk '{print $1}' >  /sentry-commands.txt

COPY ./docker/sentry.conf.py ./docker/config.yml $SENTRY_CONF/
COPY ./docker/docker-entrypoint.sh /

EXPOSE 9000
VOLUME /data

ENTRYPOINT exec /docker-entrypoint.sh $0 $@
CMD ["run", "web"]

ARG SOURCE_COMMIT
ENV SENTRY_BUILD=${SOURCE_COMMIT:-unknown}
LABEL org.opencontainers.image.revision=$SOURCE_COMMIT
LABEL org.opencontainers.image.source="https://github.com/getsentry/sentry/tree/${SOURCE_COMMIT:-master}/"
LABEL org.opencontainers.image.licenses="https://github.com/getsentry/sentry/blob/${SOURCE_COMMIT:-master}/LICENSE"
