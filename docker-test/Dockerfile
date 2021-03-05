FROM python:3.6.13-slim-stretch

# Install system packages; these need to persist throughout all the layers.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    libffi-dev \
    libjpeg-dev \
    libmemcached-dev \
    libpq-dev \
    libxml2-dev \
    libxmlsec1-dev \
    libxmlsec1-openssl \
    libxslt-dev \
    libyaml-dev \
    libmaxminddb-dev \
    make \
    && rm -rf /var/lib/apt/lists/*

# Install google-chrome + chromedriver for acceptance testing.
RUN set -x \
    && fetchDeps="dirmngr gnupg unzip" \
    && apt-get update && apt-get install -y --no-install-recommends $fetchDeps \
    && curl -L https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get -y update && apt-get install -y --no-install-recommends google-chrome-stable \
    && export CHROME_MAJOR_VERSION=$(dpkg -s google-chrome-stable | sed -nr 's/Version: ([0-9]+).*/\1/p') \
    && export CHROMEDRIVER_VERSION=$(curl -sS chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_MAJOR_VERSION}) \
    && cd /tmp \
    && curl -LO "https://chromedriver.storage.googleapis.com/$CHROMEDRIVER_VERSION/chromedriver_linux64.zip" \
    && unzip ./chromedriver_linux64.zip \
    && rm ./chromedriver_linux64.zip \
    && mv chromedriver /usr/local/bin/ \
    && chmod +x /usr/local/bin/chromedriver \
    && apt-get purge -y --auto-remove $fetchDeps \
    && rm -rf /var/lib/apt/lists/*

# Install latest postgresql client for database setup.
RUN set -x \
    && fetchDeps="dirmngr gnupg" \
    && apt-get update && apt-get install -y --no-install-recommends $fetchDeps \
    && for key in \
      B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8 \
    ; do \
      apt-key adv --keyserver hkp://p80.pool.sks-keyservers.net:80 --recv-keys "$key" || \
      apt-key adv --keyserver hkp://ipv4.pool.sks-keyservers.net --recv-keys "$key" || \
      apt-key adv --keyserver hkp://pgp.mit.edu:80 --recv-keys "$key" ; \
    done \
    && echo "deb http://apt.postgresql.org/pub/repos/apt/ stretch-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get -y update && apt-get install -y --no-install-recommends postgresql-client \
    && apt-get purge -y --auto-remove $fetchDeps \
    && rm -rf /var/lib/apt/lists/*

ENV PIP_NO_CACHE_DIR=off
ENV PIP_DISABLE_PIP_VERSION_CHECK=on
ENV PIP_SRC=/.pip
RUN pip install "pip>=20.0.2"

# Install sentry dependencies.
RUN ls -la
RUN pwd
RUN ls /usr/src
COPY requirements-base.txt ./
# gcc is needed for at least uwsgi.
# g++ is required for at least mmh3.
RUN buildDeps=" \
        g++ \
        gcc \
        pkg-config \
    " \
    && apt-get update && apt-get install -y --no-install-recommends $buildDeps \
    && pip install -r requirements-base.txt \
    && pip freeze | grep -P -v "^(sentry|enum34)==" > "/tmp/pip-freeze-before" \
    && apt-get purge -y --auto-remove $buildDeps \
    && rm -r /var/lib/apt/lists/*

# Install sentry core.
# HACK(joshuarli): due to sentry's pyproject.toml build-system, pip will attempt and fail to upgrade setuptools/wheel
# under py3 because enum34 would have been implicitly pulled in by some dependencies in getsentry requirements-base.
# If we want to keep the speed optimization gained by installing requirements-base before sentry,
# enum34 has to be uninstalled.
# This should not error, it should noop as pins should have been satisfied with getsentry's deps.
# COPY requirements-sentry.txt ./
# RUN pip uninstall -y enum34 \
    # && SENTRY_LIGHT_BUILD=1 pip install -r requirements-sentry.txt

# Compare the pip freezes to make sure sentry dependencies are synced.
# In other words, installing sentry on top of getsentry should not have changed anything.
# XXX(joshuarli): for before and after, we need to ignore sentry. Otherwise we'll always fail a diff like:
# < sentry==10.0.0
# ---
# > -e git+https://github.com/getsentry/sentry.git@SHA#egg=sentry
# RUN pip freeze | grep -v "sentry.git@" > "/tmp/pip-freeze-after" \
    # && cmp -s "/tmp/pip-freeze-before" "/tmp/pip-freeze-after" \
    # || { \
        # echo "ERROR: Installing sentry on top of getsentry resulted in dependencies changing!"; \
        # git diff "/tmp/pip-freeze-before" "/tmp/pip-freeze-after"; \
        # exit 1; \
    # }

# Install sentry python testing dependencies.
COPY requirements-dev.txt ./
RUN pip install -r requirements-dev.txt

ENV VOLTA_VERSION=0.8.1 \
    VOLTA_HOME=/.volta \
    PATH=/.volta/bin:$PATH

# Install sentry frontend modules
COPY package.json yarn.lock ./
RUN export YARN_CACHE_FOLDER="$(mktemp -d)" \
    && curl -LO "https://github.com/volta-cli/volta/releases/download/v$VOLTA_VERSION/volta-$VOLTA_VERSION-linux-openssl-1.1.tar.gz" \
    && tar -xzf "volta-$VOLTA_VERSION-linux-openssl-1.1.tar.gz" -C /usr/local/bin \
    && volta -v \
    && node -v \
    && yarn -v \
    && yarn install --frozen-lockfile \
    && rm -r "$YARN_CACHE_FOLDER" \
    && rm "volta-$VOLTA_VERSION-linux-openssl-1.1.tar.gz"

# Need to set the workdir to here, so we can access bin/test-utils.
# WORKDIR /usr/src/sentry
