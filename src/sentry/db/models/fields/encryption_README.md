# EncryptedField Implementation

This document describes the implementation of the EncryptedField for Sentry, which provides flexible encryption for sensitive database fields.

## Overview

The EncryptedField is a Django custom field that supports multiple encryption methods for storing sensitive data in the database. It provides:

- **Multiple encryption methods**: plain_text, fernet, and keysets (future)
- **Transparent encryption/decryption**: Works seamlessly with Django ORM
- **Fallback mechanism**: Can decrypt data even after switching encryption methods
- **Type variants**: EncryptedCharField, EncryptedTextField, EncryptedEmailField

## Configuration

### 1. Set the encryption method in Sentry options

```python
# Via UI or sentry.conf.py
options.set('database.encryption.method', 'fernet')  # or 'plain_text'
```

### 2. Set the Fernet key in Django settings

```python
# In settings.py
DATABASE_ENCRYPTION_FERNET_KEY = os.environ.get('DATABASE_ENCRYPTION_KEY')

# Generate a key:
# from cryptography.fernet import Fernet
# print(Fernet.generate_key())
```

## Usage

```python
from sentry.db.models.fields import EncryptedCharField, EncryptedTextField

class MyModel(Model):
    api_key = EncryptedCharField(max_length=255)
    secret_data = EncryptedTextField()
```

## Encryption Methods

### plain_text
- No encryption, stores values as-is
- Default method for development
- Useful for local testing

### fernet
- Symmetric encryption using Fernet (from cryptography library)
- Requires a 32-byte base64-encoded key
- Stores data with "fernet:" prefix for identification

### keysets (Future)
- Will support Google Tink for key rotation
- Not yet implemented

## How It Works

### Encryption (Saving to Database)

1. `get_prep_value()` is called when saving
2. Checks current encryption method from options
3. Encrypts value based on method
4. For fernet: prefixes with "fernet:" for later identification
5. Stores encrypted value in database

### Decryption (Loading from Database)

1. `from_db_value()` is called when loading
2. Checks for method prefix (e.g., "fernet:")
3. If prefix found: uses specific decryption method
4. If no prefix: tries current method, then fallbacks
5. Returns decrypted value

### Fallback Mechanism

The fallback mechanism ensures data remains readable even after changing encryption methods:

1. **With prefix**: Uses the method specified in the prefix
2. **Without prefix**:
   - Tries current encryption method first
   - Falls back to treating as plain text
   - Logs warnings but doesn't fail

This allows gradual migration from plain text to encrypted storage.

## Database Storage

- All encrypted fields use `TextField` internally
- This accommodates the expanded size of encrypted data
- Original field constraints (like max_length) are preserved at the model level

## Security Considerations

1. **Key Management**:
   - Store encryption keys in environment variables
   - Never commit keys to version control
   - Use different keys for different environments

2. **Migration Strategy**:
   - Start with plain_text in development
   - Switch to fernet in production
   - Existing data remains readable during transition

3. **Performance**:
   - Encryption/decryption happens on every field access
   - Consider caching for frequently accessed encrypted data
   - Not suitable for fields used in database queries

## Limitations

1. **No database-level operations**: Cannot use encrypted fields in:
   - WHERE clauses
   - ORDER BY
   - GROUP BY
   - Database indexes

2. **Storage overhead**: Encrypted data is larger than plain text

3. **No partial updates**: Must decrypt/encrypt entire field value

## Future Enhancements

1. **Keysets support**: Enable key rotation with Google Tink
2. **Searchable encryption**: Support for encrypted search
3. **Field-level keys**: Different keys for different fields
4. **Audit logging**: Track encryption/decryption operations

## Testing

See `tests/sentry/db/models/fields/test_encryption.py` for comprehensive tests covering:
- All encryption methods
- Method switching scenarios
- Error handling
- Different field types

## Example Implementation Analysis

The PR #83635 provided a good starting point but had some limitations:

**Improvements made:**
1. **Configurable encryption**: Original hardcoded Fernet; now configurable via options
2. **Fallback mechanism**: Original couldn't handle method changes; now has robust fallback
3. **Method identification**: Added prefixes to identify encryption method in stored data
4. **Better error handling**: Graceful degradation when keys are missing
5. **Multiple field types**: Extended beyond just CharField

**Critical considerations addressed:**
1. **Data migration**: Can switch encryption methods without data loss
2. **Key management**: Separated from field definition
3. **Development workflow**: Plain text option for local development
4. **Future extensibility**: Prepared for keysets implementation
