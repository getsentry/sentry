#!/bin/bash
set -xe

# if we already have a venv, we can leave
if .venv/bin/python --version &> /dev/null; then
  exit 0
fi

# do we have a WORKON_HOME? Prime from there
if [ "x$WORKON_HOME" != x ]; then
  ln -s "${WORKON_HOME}/sentry" .venv
  exit 0
fi

# otherwise make a new virtualenv from scratch
virtualenv -ppython2.7 .venv
