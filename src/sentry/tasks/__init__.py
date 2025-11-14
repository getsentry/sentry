from typing import int
"""Tasks

Async tasks are used to create asynchronous workers which communicate their tasks via kafka
and taskbroker in production.  There are a few conventions which need to be adhered to
when writing tasks to ensure we have reliable tasks and avoid common pitfalls, see
https://develop.sentry.dev/backend/application-domains/tasks/#defining-tasks

"""
