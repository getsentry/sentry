"""
This is the Utilities Module. It is the home to small, self-contained classes
and functions that do useful things. This description is intentionally general
because there are basically no limits to what functionality can be considered
a util. However, within this directory we should avoid importing Sentry models
or modules with side effects.
"""
# Make sure to not import anything here.  We want modules below
# sentry.utils to be able to import without having to pull in django
# or other sources that might not exist.
