#!/bin/sh

# Run from project root

./scripts/silo/audit_silo_decorators.py | ./scripts/silo/add_silo_decorators.py
./scripts/silo/decorate_models_by_relation.py
pytest --collect-only | ./scripts/silo/decorate_unit_tests.py
