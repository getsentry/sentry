FROM scratch AS odiff-amd64
ADD --chmod=755 \
    --checksum=sha256:2c17e6bcf92a58e6668f19f17f4a27fa4b1d70840994f31bd837b55bb6b297d7 \
    https://github.com/dmtrKovalenko/odiff/releases/download/v4.3.2/odiff-linux-x64 \
    /odiff

FROM scratch AS odiff-arm64
ADD --chmod=755 \
    --checksum=sha256:d65f748c463a6aa78fa7bcdd31acd797eaed5160867e7769a3b291cfea42c9a0 \
    https://github.com/dmtrKovalenko/odiff/releases/download/v4.3.2/odiff-linux-arm64 \
    /odiff

ARG TARGETARCH
FROM odiff-${TARGETARCH} AS odiff

FROM python:3.13.15-slim-trixie

LABEL maintainer="oss@sentry.io"
LABEL org.opencontainers.image.title="Sentry"
LABEL org.opencontainers.image.description="Sentry runtime image"
LABEL org.opencontainers.image.url="https://sentry.io/"
LABEL org.opencontainers.image.documentation="https://develop.sentry.dev/self-hosted/"
LABEL org.opencontainers.image.vendor="Functional Software, Inc."
LABEL org.opencontainers.image.authors="oss@sentry.io"

# add our user and group first to make sure their IDs get assigned consistently
RUN groupadd -r sentry --gid 999 && useradd -r -m -g sentry --uid 999 sentry

RUN : \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        libexpat1 \
        tini \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=odiff /odiff /usr/local/bin/odiff

WORKDIR /usr/src/sentry

ENV PATH="/.venv/bin:$PATH" UV_PROJECT_ENVIRONMENT=/.venv \
    PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_COMPILE_BYTECODE=1 UV_NO_CACHE=1

RUN python3 -m pip install --index-url 'https://pypi.devinfra.sentry.io/simple' 'uv==0.12.10'

# We don't want uv-managed python, we want to use python from the image.
# We only want to use uv to manage dependencies.
RUN python3 -m venv /.venv

ENV \
  # Sentry config params
  SENTRY_CONF=/etc/sentry \
  # grpcio>1.30.0 requires this, see requirements.txt for more detail.
  GRPC_POLL_STRATEGY=epoll1

# Install dependencies first to leverage Docker layer caching.
COPY uv.lock pyproject.toml .
RUN set -x \
  # --no-build: every locked dependency ships a wheel, so fail rather than
  # silently compile from source (the image has no compiler).
  && uv sync --frozen --quiet --no-install-project --no-build \
  # Fully verify that the C extension is correctly installed, it unfortunately
  # requires a full check into maxminddb.extension.Reader
  && python -c 'import maxminddb.extension; maxminddb.extension.Reader' \
  && mkdir -p $SENTRY_CONF

COPY . .
RUN : \
    && python3 -m tools.fast_editable --path . \
    && python3 -m compileall -q src/ \
    && python3 -m sentry.build.dump_cli_commands > /sentry-commands.txt

COPY ./self-hosted/sentry.conf.py ./self-hosted/config.yml $SENTRY_CONF/
COPY ./self-hosted/docker_entrypoint.py /

RUN : double-check some built files are available \
    && test -f /usr/src/sentry/src/sentry/loader/_registry.json \
    && test -f /usr/src/sentry/src/sentry/integration-docs/python.json \
    && test -f /usr/src/sentry/src/sentry/static/sentry/dist/entrypoints/app.js \
    && sentry help

# Pre-create /data owned by sentry so fresh named volumes are initialized
# with the right ownership. This must happen before the VOLUME instruction.
RUN mkdir -p /data/files && chown -R sentry:sentry /data

USER sentry

EXPOSE 9000
VOLUME /data

ENTRYPOINT ["python3", "/docker_entrypoint.py"]
CMD ["run", "web"]

ARG SOURCE_COMMIT
ENV SENTRY_BUILD=${SOURCE_COMMIT:-unknown}
LABEL org.opencontainers.image.revision=$SOURCE_COMMIT
LABEL org.opencontainers.image.source="https://github.com/getsentry/sentry/tree/${SOURCE_COMMIT:-master}/"
LABEL org.opencontainers.image.licenses="https://github.com/getsentry/sentry/blob/${SOURCE_COMMIT:-master}/LICENSE"
