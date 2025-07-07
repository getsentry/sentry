"""
Example of using EncryptedField in a Django model.

This example shows how to use the encrypted field to store sensitive data
like API keys, personal information, etc.
"""

from django.db import models
from sentry.db.models import Model
from sentry.db.models.fields import EncryptedCharField, EncryptedTextField


class SensitiveDataModel(Model):
    """Example model with encrypted fields for storing sensitive data."""

    # Encrypted API key - will be stored encrypted in database
    api_key = EncryptedCharField(max_length=255, help_text="Encrypted API key")

    # Encrypted personal notes
    private_notes = EncryptedTextField(blank=True, null=True)

    # Regular field for comparison
    public_name = models.CharField(max_length=100)

    class Meta:
        app_label = "examples"
        db_table = "example_sensitive_data"


# Configuration in settings.py:
# ---------------------------
#
# # Set the Fernet encryption key (must be 32 bytes, base64 encoded)
# # Generate with: from cryptography.fernet import Fernet; print(Fernet.generate_key())
# DATABASE_ENCRYPTION_FERNET_KEY = os.environ.get('DATABASE_ENCRYPTION_KEY')
#
# # Or for development/testing with plain text:
# DATABASE_ENCRYPTION_FERNET_KEY = None


# Configuration in sentry.conf.py or via UI:
# -----------------------------------------
#
# # Set the encryption method via options
# # Options: 'plain_text', 'fernet', 'keysets' (future)
# options.set('database.encryption.method', 'fernet')


# Usage examples:
# --------------

def example_usage():
    """Example of using the encrypted field."""

    # Create a new instance
    sensitive_data = SensitiveDataModel()
    sensitive_data.api_key = "sk-1234567890abcdef"  # Will be encrypted
    sensitive_data.private_notes = "This is sensitive information"
    sensitive_data.public_name = "Public API"
    sensitive_data.save()

    # Query and decrypt automatically
    retrieved = SensitiveDataModel.objects.get(id=sensitive_data.id)
    print(f"API Key: {retrieved.api_key}")  # Automatically decrypted
    print(f"Notes: {retrieved.private_notes}")  # Automatically decrypted

    # The data is encrypted in the database
    # If you query the database directly, you'll see something like:
    # api_key: "fernet:gAAAAABh3K4X..."


def switching_encryption_methods():
    """Example of switching between encryption methods."""

    # Start with plain text (development)
    # options.set('database.encryption.method', 'plain_text')
    # Data saved: "my-secret-key"

    # Switch to Fernet encryption (production)
    # options.set('database.encryption.method', 'fernet')
    # New data saved: "fernet:gAAAAABh3K4X..."
    # Old plain text data can still be read!

    # The field handles both encrypted and plain text data
    # This allows gradual migration without data loss
