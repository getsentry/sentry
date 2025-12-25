"""
API Package - MFA Authentication Endpoints

This package contains the fixed implementation of the MFA authentication API
that properly handles both UUID and non-UUID user identifiers.
"""

__version__ = "1.0.0"
__author__ = "Sentry Development Team"

# Package documentation
__doc__ = """
API Package with UUID Fix
=========================

This package contains the fix for:
    ValueError: badly formed hexadecimal UUID string
    (occurred in: /api/v1/auth/mfa/logs)

Key Files:
---------
- routes/mfa.py: MFA endpoints with proper UUID validation
- demo_fix.py: Demonstration of the bug and fix
- README_UUID_FIX.md: Comprehensive documentation
- CHANGES.md: Before/after comparison
- QUICK_REFERENCE.md: Quick reference guide

Usage:
------
See README_UUID_FIX.md for full documentation.

Quick demo:
    python3 api/demo_fix.py
"""
