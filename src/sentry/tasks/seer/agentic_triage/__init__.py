"""Scheduled agentic triage.

Night Shift option/feature keys, API paths, Seer feature IDs, referrer values,
storage names, and log/metric identifiers remain stable for existing configuration and consumers.
Task dispatch keeps the deployed names so older workers can consume new work.
Agentic triage task aliases are registered for a future coordinated cutover;
the scheduler entry key also stays stable to preserve its Redis run state.
"""
