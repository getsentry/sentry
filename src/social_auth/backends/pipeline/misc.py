from __future__ import absolute_import

from social_auth.backends import PIPELINE
from social_auth.utils import setting


def save_status_to_session(request, auth, pipeline_index, *args, **kwargs):
    """Saves current social-auth status to session."""
    next_entry = setting('SOCIAL_AUTH_PIPELINE_RESUME_ENTRY')

    if next_entry and next_entry in PIPELINE:
        idx = PIPELINE.index(next_entry)
    else:
        idx = pipeline_index + 1

    data = auth.to_session_dict(idx, *args, **kwargs)
    name = setting('SOCIAL_AUTH_PARTIAL_PIPELINE_KEY', 'partial_pipeline')
    request.session[name] = data
