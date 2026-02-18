"""
Types Directory - a place to keep types and enums.

In order to avoid circular imports, DO NOT import any models or serializers
anywhere in this directory.

There are going to naming collisions between classes like "Type" and "Status".
The best way to resolve this is to prefix them with more context.
"""

from sentry.types.id import Id as Id
