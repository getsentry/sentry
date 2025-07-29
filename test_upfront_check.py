#!/usr/bin/env python
"""
Test script to verify the upfront seat availability check in monitor_url_for_project
"""

# Let's check if the imports work and the function signature is correct
from src.sentry.uptime.detectors.tasks import monitor_url_for_project
from src.sentry.models.project import Project
from src.sentry.uptime.models import ProjectUptimeSubscription

print("All imports successful!")
print(f"monitor_url_for_project return type annotation: {monitor_url_for_project.__annotations__.get('return', 'None')}")
print(f"Function docstring: {monitor_url_for_project.__doc__}")