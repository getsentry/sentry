from __future__ import annotations

from django.db.models import Model

from sentry.api.serializers.base import registry
from sentry.testutils.silo import (
    validate_models_have_silos,
    validate_no_cross_silo_deletions,
    validate_no_cross_silo_foreign_keys,
)

decorator_exemptions: set[type[Model]] = set()
fk_exemptions: set[tuple[type[Model], type[Model]]] = set()


def test_models_have_silos():
    validate_models_have_silos(decorator_exemptions)


def test_silo_foreign_keys():
    for unused in fk_exemptions - validate_no_cross_silo_foreign_keys(fk_exemptions):
        raise ValueError(f"fk_exemptions includes non conflicting relation {unused!r}")


def test_cross_silo_deletions():
    validate_no_cross_silo_deletions(fk_exemptions)


# We really should not be using api serializers with the hybrid cloud data classes.
# For instance, if you need to serialize one of these objects, better to do so manually inside of some other serializer
# in general.  A big reason for this is that the hybrid cloud data classes are internal objects that are going to be
# used in an internal API -- they are designed specifically not to be rendered back in our public apis.
# Secondly, there should never be any custom serialization logic -- all of our hybrid cloud objects will be
# serialized and deserialized using narrow, very thin protocol logic, which will not be adhoc written per type.
# If you're unsure how to proceed, ping the project-hybrid-cloud channel to get some assistance.
def test_no_serializers_for_hybrid_cloud_dataclasses():
    for type in registry.keys():
        if "hybrid_cloud" in type.__module__:
            raise ValueError(
                f"{type!r} has a registered serializer, but we should not create serializers for hybrid cloud dataclasses."
            )
