"""
Trace Metrics EAP (Events Analytics Platform) Module

This module provides EAP support for the Trace Metrics dataset, which is a clone
of the OurLogs implementation with additional metric-specific fields.

Key Components:
- attributes.py: Defines all available fields and attributes for trace metrics
- definitions.py: Combines attributes, aggregates, and configurations into a single definition
- aggregates.py: Defines available aggregate functions (currently reuses log aggregates)

New Fields:
- metric_name: Simple sentry field for metric names
- metric_type: Simple sentry field for metric types

Usage:
The tracemetrics dataset can be accessed via the events endpoint by setting:
dataset=tracemetrics

This will use the EAP-based RPC implementation for querying trace metrics data.
"""
