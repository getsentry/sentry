# Generated manually for OAuth 2.1 public client support and refresh token rotation

from django.db import migrations, models


class Migration(migrations.Migration):
    """Add support for public OAuth clients and refresh token rotation.

    This migration implements RFC 9700 §4.14.2 (OAuth 2.0 Security Best Current Practice)
    for secure refresh token handling with public clients.

    Changes:
    1. ApiApplication.client_secret: Made nullable to support public clients (RFC 6749 §2.1)
       - Public clients (CLIs, native apps, SPAs) cannot securely store secrets
       - They use PKCE for authorization and token rotation for refresh

    2. ApiToken rotation fields for replay detection:
       - token_family_id: Groups tokens from the same original authorization
       - previous_refresh_token_hash: Detects replay of rotated-out tokens
       - is_refresh_token_active: Marks whether refresh_token can still be used

    Security model:
    - Each refresh for public clients issues a new refresh token
    - Old refresh tokens are invalidated
    - If an old token is reused (replay attack), the entire family is revoked
    """

    dependencies = [
        ("sentry", "1018_encrypt_integration_metadata"),
    ]

    operations = [
        # Make client_secret nullable for public clients
        migrations.AlterField(
            model_name="apiapplication",
            name="client_secret",
            field=models.TextField(blank=True, null=True, default=None),
            # Note: default=None for new public clients; existing apps keep their secrets
        ),
        # Add token family ID for grouping related tokens
        migrations.AddField(
            model_name="apitoken",
            name="token_family_id",
            field=models.UUIDField(db_index=True, null=True),
        ),
        # Add hash of previous refresh token for replay detection
        migrations.AddField(
            model_name="apitoken",
            name="previous_refresh_token_hash",
            field=models.CharField(db_index=True, max_length=128, null=True),
        ),
        # Add flag to track if refresh token is still active
        migrations.AddField(
            model_name="apitoken",
            name="is_refresh_token_active",
            field=models.BooleanField(db_default=True, default=True, null=True),
        ),
    ]
