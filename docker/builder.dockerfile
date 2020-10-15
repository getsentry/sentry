FROM python:3.6-slim-buster as sdist

LABEL maintainer="oss@sentry.io"
LABEL org.opencontainers.image.title="Sentry Wheel Builder"
LABEL org.opencontainers.image.description="Python Wheel Builder for Sentry"
LABEL org.opencontainers.image.url="https://sentry.io/"
LABEL org.opencontainers.image.vendor="Functional Software, Inc."
LABEL org.opencontainers.image.authors="oss@sentry.io"

# Sane defaults for pip
ENV PIP_NO_CACHE_DIR=off \
  PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
  # Needed for fetching stuff
  wget \
  && rm -rf /var/lib/apt/lists/* \
  # Needed to extract final dependencies from the whl
  && pip install pkginfo==1.5.0.1

# Get and set up Node for front-end asset building
ENV VOLTA_VERSION=0.8.1 \
  VOLTA_HOME=/.volta \
  PATH=/.volta/bin:$PATH

RUN wget "https://github.com/volta-cli/volta/releases/download/v$VOLTA_VERSION/volta-$VOLTA_VERSION-linux-openssl-1.1.tar.gz" \
  && tar -xzf "volta-$VOLTA_VERSION-linux-openssl-1.1.tar.gz" -C /usr/local/bin \
  # Running `volta -v` triggers setting up the shims in VOLTA_HOME (otherwise node won't work)
  && volta -v

WORKDIR /js

COPY package.json /js
# Running `node -v` and `yarn -v` triggers Volta to install the versions set in the project
RUN node -v && yarn -v

COPY yarn.lock /js
RUN export YARN_CACHE_FOLDER="$(mktemp -d)" \
  && yarn install --frozen-lockfile --production --quiet \
  && rm -r "$YARN_CACHE_FOLDER"

WORKDIR /workspace
VOLUME ["/workspace/node_modules", "/workspace/build"]
COPY docker/builder.sh /builder.sh
ENTRYPOINT [ "/builder.sh" ]

# TODO: Remove this once PY3 becomes stable
ENV SENTRY_PYTHON3=1

ARG SOURCE_COMMIT
ENV SENTRY_BUILD=${SOURCE_COMMIT:-unknown}
LABEL org.opencontainers.image.revision=$SOURCE_COMMIT
LABEL org.opencontainers.image.source="https://github.com/getsentry/sentry/tree/${SOURCE_COMMIT:-master}/"
LABEL org.opencontainers.image.licenses="https://github.com/getsentry/sentry/blob/${SOURCE_COMMIT:-master}/LICENSE"
