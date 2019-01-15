# Build from any git sha by passing `--build-arg SENTRY_BUILD=<sha>`
FROM python:2.7.15-slim-jessie

# add our user and group first to make sure their IDs get assigned consistently
RUN groupadd -r sentry && useradd -r -m -g sentry sentry

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        git \
        libffi-dev \
        libjpeg-dev \
        libpq-dev \
        libxml2-dev \
        libxmlsec1-dev \
        libxslt-dev \
        libyaml-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Sane defaults for pip
ENV PIP_NO_CACHE_DIR off
ENV PIP_DISABLE_PIP_VERSION_CHECK on

# grab gosu for easy step-down from root
RUN set -x \
    && export GOSU_VERSION=1.10 \
    && apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/* \
    && wget -O /usr/local/bin/gosu "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-$(dpkg --print-architecture)" \
    && wget -O /usr/local/bin/gosu.asc "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-$(dpkg --print-architecture).asc" \
    && export GNUPGHOME="$(mktemp -d)" \
    && gpg --batch --keyserver ha.pool.sks-keyservers.net --recv-keys B42F6819007F00F88E364FD4036A9C25BF357DD4 \
    && gpg --batch --verify /usr/local/bin/gosu.asc /usr/local/bin/gosu \
    && rm -r "$GNUPGHOME" /usr/local/bin/gosu.asc \
    && chmod +x /usr/local/bin/gosu \
    && gosu nobody true \
    && apt-get purge -y --auto-remove wget

# grab tini for signal processing and zombie killing
RUN set -x \
    && export TINI_VERSION=0.18.0 \
    && apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/* \
    && wget -O /usr/local/bin/tini "https://github.com/krallin/tini/releases/download/v$TINI_VERSION/tini" \
    && wget -O /usr/local/bin/tini.asc "https://github.com/krallin/tini/releases/download/v$TINI_VERSION/tini.asc" \
    && export GNUPGHOME="$(mktemp -d)" \
    && gpg --batch --keyserver ha.pool.sks-keyservers.net --recv-keys 595E85A6B1B4779EA4DAAEC70B588DFF0527A9B7 \
    && gpg --batch --verify /usr/local/bin/tini.asc /usr/local/bin/tini \
    && rm -r "$GNUPGHOME" /usr/local/bin/tini.asc \
    && chmod +x /usr/local/bin/tini \
    && tini -h \
    && apt-get purge -y --auto-remove wget

# Support for RabbitMQ
RUN set -x \
    && apt-get update && apt-get install -y --no-install-recommends make && rm -rf /var/lib/apt/lists/* \
    && pip install librabbitmq==1.6.1 \
    && python -c 'import librabbitmq' \
    && apt-get purge -y --auto-remove make

ARG SENTRY_BUILD=master
ENV SENTRY_BUILD $SENTRY_BUILD
RUN mkdir -p /usr/src/sentry

#COPY sentry-9.1.0.dev0.tar.gz /usr/src/sentry/

COPY sentry-9.1.0.dev0-py27-none-any.whl /usr/src/sentry/

#RUN pip install /usr/src/sentry/sentry-9.1.0.dev0-py27-none-any.whl

RUN python --version

RUN [ "$SENTRY_BUILD" != '' ] \
    # Install node to build assets
    && export NODE_VERSION=8.9.1 \
    && export YARN_VERSION=1.3.2 \
    && export GNUPGHOME="$(mktemp -d)" \
    && export NPM_CONFIG_CACHE="$(mktemp -d)" \
    && export YARN_CACHE_FOLDER="$(mktemp -d)" \
    # gpg keys listed at https://github.com/nodejs/node
    && for key in \
      94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
      B9AE9905FFD7803F25714661B63B535A4C206CA9 \
      77984A986EBC2AA786BC0F66B01FBB92821C587A \
      56730D5401028683275BD23C23EFEFE93C4CFFFE \
      71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
      FD3A5288F042B6850C66B31F09FE44734EB7990E \
      C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
      DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
    ; do \
      gpg --batch --keyserver ha.pool.sks-keyservers.net --recv-keys "$key"; \
    done \
    && mkdir -p /usr/local/node && PATH=/usr/local/node/bin:$PATH \
    && apt-get update && apt-get install -y --no-install-recommends make g++ wget \
    && rm -rf /var/lib/apt/lists/* \
    && wget "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz" \
    && wget "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
    && gpg --batch --verify SHASUMS256.txt.asc \
    && grep " node-v$NODE_VERSION-linux-x64.tar.gz\$" SHASUMS256.txt.asc | sha256sum -c - \
    && tar -xzf "node-v$NODE_VERSION-linux-x64.tar.gz" -C /usr/local/node --strip-components=1 \
    && rm -r "$GNUPGHOME" "node-v$NODE_VERSION-linux-x64.tar.gz" SHASUMS256.txt.asc \
    && npm install -g yarn@$YARN_VERSION \
    && cd /usr/src/sentry \
    && python --version \
    && pip install /usr/src/sentry/sentry-9.1.0.dev0-py27-none-any.whl

ENV SENTRY_CONF=/etc/sentry \
    SENTRY_FILESTORE_DIR=/var/lib/sentry/files

RUN mkdir -p $SENTRY_CONF && mkdir -p $SENTRY_FILESTORE_DIR

COPY sentry.conf.py /etc/sentry/
COPY config.yml /etc/sentry/

COPY docker-entrypoint.sh /entrypoint.sh

EXPOSE 9000
VOLUME /var/lib/sentry/files

ENTRYPOINT ["/entrypoint.sh"]
CMD ["run", "web"]
