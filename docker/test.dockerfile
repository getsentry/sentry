FROM debian:buster-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
  && rm -rf /var/lib/apt/lists/*

COPY onpremise-v10/test.sh test.sh
