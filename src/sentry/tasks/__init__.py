"""Celery tasks.

Celery tasks are used to create asynchronous workers which communicate their tasks via a
message broker, RabbitMQ in prod.  There are a few conventions which need to be adhered to
when writing tasks to ensure we have reliable tasks and avoid common pitfalls, see
https://develop.sentry.dev/services/queue/#registering-a-task for the current documentation.

"""
