# Sentry ML Models

This directory contains machine learning models used by Sentry.

## Tokenizer Model

### jina-embeddings-v2-base-en

This directory contains the tokenizer model for the Jina AI embeddings v2 base English model.

- **Model**: `jinaai/jina-embeddings-v2-base-en`
- **File**: `jina-embeddings-v2-base-en/tokenizer.json`
- **Usage**: Used by `src/sentry/seer/similarity/utils.py` for tokenizing stacktrace text

### Updating the Model

To update or re-download the tokenizer model, you can run:

```python
from tokenizers import Tokenizer
import os
from sentry.constants import DATA_ROOT

# Download and save the model
tokenizer = Tokenizer.from_pretrained("jinaai/jina-embeddings-v2-base-en")
model_path = os.path.join(DATA_ROOT, "models", "jina-embeddings-v2-base-en", "tokenizer.json")
os.makedirs(os.path.dirname(model_path), exist_ok=True)
tokenizer.save(model_path)
```
