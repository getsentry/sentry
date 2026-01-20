# Generated manually for OAuth 2.1 public client support

from django.db import migrations, models

import sentry.models.apiapplication
from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    """Add support for public OAuth clients.

    This migration implements RFC 6749 §2.1 to support public clients
    (CLIs, native apps, SPAs) that cannot securely store client secrets.

    Changes:
    1. ApiApplication.client_secret: Made nullable to support public clients
       - Public clients are created by explicitly passing client_secret=None
       - They use PKCE for authorization code flow
       - They use refresh token rotation for token refresh
    """

    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # For schema changes like adding nullable fields, this should be False (run during deploy).
    is_post_deployment = False

    dependencies = [
        ("sentry", "1018_encrypt_integration_metadata"),
    ]

    operations = [
        # Make client_secret nullable for public clients
        migrations.AlterField(
            model_name="apiapplication",
            name="client_secret",
            field=models.TextField(
                blank=True,
                null=True,
                default=sentry.models.apiapplication.generate_token,
            ),
            # Note: default still generates a token for backward compatibility
            # Public clients are created by explicitly passing client_secret=None
        ),
    ]
