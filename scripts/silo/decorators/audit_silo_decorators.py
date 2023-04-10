#!/usr/bin/env sentry exec

from __future__ import annotations

from sentry.runner import configure

configure()

from sentry.utils.silo.audit_silo_decorators import audit_silo_decorators

if __name__ == "__main__":
    audit_silo_decorators()
