#!/bin/bash
set -eu

# Install mkcert's root certificate
mkcert -install

# Add mkcert's root certificate into the local python certificate store
cat $(mkcert -CAROOT)/rootCA.pem >>$(python -m certifi)

# Geneate local certificates for dev
mkcert -key-file config/localhost-key.pem -cert-file config/localhost.pem localhost 127.0.0.1 dev.getsentry.net *.dev.getsentry.net
