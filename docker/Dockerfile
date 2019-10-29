FROM python:2.7.16-slim-buster as sdist

LABEL maintainer="oss@sentry.io"
LABEL org.opencontainers.image.title="Sentry PyPI Wheel"
LABEL org.opencontainers.image.description="PyPI Wheel Builder for Sentry"
LABEL org.opencontainers.image.url="https://sentry.io/"
LABEL org.opencontainers.image.source="https://github.com/getsentry/sentry"
LABEL org.opencontainers.image.vendor="Functional Software, Inc."
LABEL org.opencontainers.image.authors="oss@sentry.io"

RUN apt-get update && apt-get install -y --no-install-recommends \
    # Needed for GPG
    dirmngr \
    gnupg \
    # Needed for fetching stuff
    wget \
    libarchive-tools \
    && rm -rf /var/lib/apt/lists/*

# Fetch trusted keys
RUN for key in \
      # gosu
      B42F6819007F00F88E364FD4036A9C25BF357DD4 \
      # tini
      595E85A6B1B4779EA4DAAEC70B588DFF0527A9B7 \
      # Node - gpg keys listed at https://github.com/nodejs/node
      94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
      FD3A5288F042B6850C66B31F09FE44734EB7990E \
      71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
      DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
      C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
      B9AE9905FFD7803F25714661B63B535A4C206CA9 \
      77984A986EBC2AA786BC0F66B01FBB92821C587A \
      8FCCA13FEF1D0C2E91008E09770F7A9A5AE15600 \
      4ED778F539E3634C779C87C6D7062848A1AB005C \
      A48C2BEE680E841632CD4E44F07496B3EB3C1762 \
      B9E2F5981AA6E0CD28160D9FF13993A75599653C \
    ; do \
      # TODO(byk): Replace the keyserver below w/ something owned by Sentry
      gpg --batch --keyserver hkps://mattrobenolt-keyserver.global.ssl.fastly.net:443 --recv-keys "$key"; \
    done

# grab gosu for easy step-down from root
ENV GOSU_VERSION 1.11
RUN set -x \
    && wget -O /usr/local/bin/gosu "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-$(dpkg --print-architecture)" \
    && wget -O /usr/local/bin/gosu.asc "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-$(dpkg --print-architecture).asc" \
    && gpg --batch --verify /usr/local/bin/gosu.asc /usr/local/bin/gosu \
    && rm -r /usr/local/bin/gosu.asc \
    && chmod +x /usr/local/bin/gosu

# grab tini for signal processing and zombie killing
ENV TINI_VERSION 0.18.0
RUN set -x \
    && wget -O /usr/local/bin/tini "https://github.com/krallin/tini/releases/download/v$TINI_VERSION/tini" \
    && wget -O /usr/local/bin/tini.asc "https://github.com/krallin/tini/releases/download/v$TINI_VERSION/tini.asc" \
    && gpg --batch --verify /usr/local/bin/tini.asc /usr/local/bin/tini \
    && rm /usr/local/bin/tini.asc \
    && chmod +x /usr/local/bin/tini

# Get and set up Node for front-end asset building
COPY .nvmrc /usr/src/sentry/
RUN cd /usr/src/sentry \
    && export NODE_VERSION="$(cat .nvmrc)" \
    && wget "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz" \
    && wget "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
    && gpg --batch --verify SHASUMS256.txt.asc \
    && grep " node-v$NODE_VERSION-linux-x64.tar.gz\$" SHASUMS256.txt.asc | sha256sum -c - \
    && tar -xzf "node-v$NODE_VERSION-linux-x64.tar.gz" -C /usr/local --strip-components=1 \
    && rm -r "node-v$NODE_VERSION-linux-x64.tar.gz" SHASUMS256.txt.asc

ARG SOURCE_COMMIT
ENV SENTRY_BUILD=${SOURCE_COMMIT:-unknown}
LABEL org.opencontainers.image.revision=$SOURCE_COMMIT
LABEL org.opencontainers.image.licenses="https://github.com/getsentry/sentry/blob/${SOURCE_COMMIT:-master}/LICENSE"

COPY . /usr/src/sentry/
RUN export YARN_CACHE_FOLDER="$(mktemp -d)" \
    && cd /usr/src/sentry \
    && python setup.py bdist_wheel \
    && wget -qO- https://github.com/getsentry/sentry-plugins/archive/master.zip | bsdtar -xvf- \
    && cd sentry-plugins-master \
    && PYTHONPATH=/usr/src/sentry/src python setup.py bdist_wheel -d ../dist \
    && rm -r "$YARN_CACHE_FOLDER" \
    && mv /usr/src/sentry/dist /dist

# This is the image to be run
FROM python:2.7.16-slim-buster

LABEL maintainer="oss@sentry.io"
LABEL org.opencontainers.image.title="Sentry"
LABEL org.opencontainers.image.description="Sentry runtime image"
LABEL org.opencontainers.image.url="https://sentry.io/"
LABEL org.opencontainers.image.documentation="https://github.com/getsentry/onpremise/tree/v10"
LABEL org.opencontainers.image.source="https://github.com/getsentry/sentry"
LABEL org.opencontainers.image.vendor="Functional Software, Inc."
LABEL org.opencontainers.image.authors="oss@sentry.io"


# add our user and group first to make sure their IDs get assigned consistently
RUN groupadd -r sentry && useradd -r -m -g sentry sentry

COPY --from=sdist /usr/local/bin/gosu /usr/local/bin/tini /usr/local/bin/

# Sane defaults for pip
ENV PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_USE_PEP517=off \
    # Sentry config params
    SENTRY_CONF=/etc/sentry \
    SENTRY_FILESTORE_DIR=/var/lib/sentry/files \
    # Disable some unused uWSGI features, saving dependencies
    # Thank to https://stackoverflow.com/a/25260588/90297
    UWSGI_PROFILE_OVERRIDE=ssl=false;xml=false;routing=false \
    # UWSGI dogstatsd plugin
    UWSGI_NEED_PLUGIN=/var/lib/uwsgi/dogstatsd

COPY --from=sdist /dist/*.whl /tmp/dist/
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
    # librabbitmq
    && buildDeps="$buildDeps \
      make \
    " \
       # xmlsec
    && buildDeps="$buildDeps \
      libxmlsec1-dev \
      pkg-config \
    " \
    && apt-get update \
    && apt-get install -y --no-install-recommends $buildDeps \
    && pip install /tmp/dist/*.whl \
    # Separate these due to https://git.io/fjyz6
    # Otherwise librabbitmq will install the latest amqp version,
    # violating kombu's amqp<2.0 constraint.
    && pip install librabbitmq==1.6.1 \
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
    && python -c 'import librabbitmq' \
    # Fully verify that the C extension is correctly installed, it unfortunately
    # requires a full check into maxminddb.extension.Reader
    && python -c 'import maxminddb.extension; maxminddb.extension.Reader' \
    && mkdir -p $SENTRY_CONF && mkdir -p $SENTRY_FILESTORE_DIR

COPY ./docker/docker-entrypoint.sh ./docker/sentry.conf.py ./docker/config.yml $SENTRY_CONF/

EXPOSE 9000
VOLUME /var/lib/sentry/files

ENTRYPOINT exec $SENTRY_CONF/docker-entrypoint.sh $0 $@
CMD ["run", "web"]

ARG SOURCE_COMMIT
LABEL org.opencontainers.image.revision=$SOURCE_COMMIT
LABEL org.opencontainers.image.licenses="https://github.com/getsentry/sentry/blob/${SOURCE_COMMIT:-master}/LICENSE"
