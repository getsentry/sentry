"""Django-Social-Auth Pipeline.

Pipelines must return a dictionary with values that will be passed as parameter
to next pipeline item. Pipelines must take **kwargs parameters to avoid
failure. At some point a pipeline entry must create a UserSocialAuth instance
and load it to the output if the user logged in correctly.
"""
from __future__ import absolute_import
