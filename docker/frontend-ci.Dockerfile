FROM node:12-buster-slim AS builder

# Install system packages; these need to persist throughout all the layers.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the node and yarn versions in package.json via volta.
# Eventually, this will be removed once static asset building is separated.
# These versions change infrequently.
ENV VOLTA_VERSION=0.8.1 \
    VOLTA_ARCH=linux-openssl-1.1 \
    VOLTA_HOME=/.volta \
    PATH=/.volta/bin:$PATH

COPY package.json .
RUN curl -fsSL "https://github.com/volta-cli/volta/releases/download/v${VOLTA_VERSION}/volta-${VOLTA_VERSION}-${VOLTA_ARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin \
    && volta -v \
    && node -v \
    && yarn -v

# Install getsentry node dependencies.
COPY yarn.lock ./
RUN export YARN_CACHE_FOLDER="$(mktemp -d)" \
    && yarn install --frozen-lockfile \
    && rm -r "$YARN_CACHE_FOLDER"


FROM builder
VOLUME ["/workspace"]
COPY . .
ENV NODE_ENV development
ENV NO_TS_FORK 1
ENV IS_ACCEPTANCE_TEST 1
ENV DOCKER_CI 1
ENTRYPOINT ["yarn"]
CMD ["build-acceptance", "--output-path=/workspace"]
