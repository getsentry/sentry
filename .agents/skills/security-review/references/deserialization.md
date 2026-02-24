# Insecure Deserialization Reference

## Overview

Serialization converts objects into transferable data formats, while deserialization reconstructs those objects. Native language serialization formats pose significant risks—enabling denial-of-service, access control breaches, or remote code execution when processing untrusted input.

## The Risk

When an application deserializes untrusted data:
1. Attacker crafts malicious serialized data
2. Application deserializes it, instantiating objects
3. Object constructors/destructors execute attacker-controlled code
4. Results: RCE, DoS, authentication bypass, data tampering

---

## Language-Specific Vulnerabilities

### Python

#### Dangerous Functions

```python
# VULNERABLE: pickle with untrusted data
import pickle
data = pickle.loads(untrusted_data)  # RCE possible

# VULNERABLE: yaml.load (pre-5.1)
import yaml
data = yaml.load(untrusted_data)  # RCE via !!python/object

# VULNERABLE: marshal
import marshal
code = marshal.loads(untrusted_data)

# VULNERABLE: shelve (uses pickle)
import shelve
db = shelve.open('data')
```

#### Safe Alternatives

```python
# SAFE: JSON
import json
data = json.loads(untrusted_data)  # Only primitive types

# SAFE: yaml.safe_load
import yaml
data = yaml.safe_load(untrusted_data)  # No arbitrary objects

# SAFE: Explicit data classes with validation
from dataclasses import dataclass
from dacite import from_dict

@dataclass
class UserInput:
    name: str
    email: str

data = from_dict(UserInput, json.loads(untrusted_data))
```

#### Detection Patterns

```python
# Base64-encoded pickle often starts with: gASV
# Or hex: 80 04 95

import base64
if b'\x80\x04\x95' in base64.b64decode(data):
    # Likely pickle data
    pass
```

### Java

#### Dangerous Patterns

```java
// VULNERABLE: ObjectInputStream
ObjectInputStream ois = new ObjectInputStream(inputStream);
Object obj = ois.readObject();  // RCE via gadget chains

// VULNERABLE: XMLDecoder
XMLDecoder decoder = new XMLDecoder(inputStream);
Object obj = decoder.readObject();

// VULNERABLE: XStream (versions ≤ 1.4.6)
XStream xstream = new XStream();
Object obj = xstream.fromXML(xml);

// VULNERABLE: SnakeYAML
Yaml yaml = new Yaml();
Object obj = yaml.load(untrustedInput);
```

#### Safe Alternatives

```java
// SAFE: Allowlist filter for ObjectInputStream
public class SafeObjectInputStream extends ObjectInputStream {
    private static final Set<String> ALLOWED_CLASSES = Set.of(
        "java.lang.String",
        "java.lang.Integer",
        "com.example.SafeDTO"
    );

    @Override
    protected Class<?> resolveClass(ObjectStreamClass desc)
            throws IOException, ClassNotFoundException {
        if (!ALLOWED_CLASSES.contains(desc.getName())) {
            throw new InvalidClassException("Unauthorized class: " + desc.getName());
        }
        return super.resolveClass(desc);
    }
}

// SAFE: JSON with explicit types
ObjectMapper mapper = new ObjectMapper();
mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
UserDTO user = mapper.readValue(json, UserDTO.class);

// SAFE: XStream with allowlist
XStream xstream = new XStream();
xstream.allowTypes(new Class[] { SafeDTO.class });
```

#### Detection Patterns

```java
// Java serialized objects start with: AC ED 00 05
// Base64: rO0AB
// Content-Type: application/x-java-serialized-object
```

### .NET

#### Dangerous Patterns

```csharp
// VULNERABLE: BinaryFormatter (NEVER USE)
BinaryFormatter formatter = new BinaryFormatter();
object obj = formatter.Deserialize(stream);
// Microsoft: "BinaryFormatter is dangerous and cannot be secured"

// VULNERABLE: NetDataContractSerializer
NetDataContractSerializer serializer = new NetDataContractSerializer();
object obj = serializer.ReadObject(stream);

// VULNERABLE: ObjectStateFormatter
ObjectStateFormatter formatter = new ObjectStateFormatter();
object obj = formatter.Deserialize(data);

// VULNERABLE: JSON.Net with TypeNameHandling
JsonConvert.DeserializeObject(json, new JsonSerializerSettings {
    TypeNameHandling = TypeNameHandling.All  // RCE possible
});
```

#### Safe Alternatives

```csharp
// SAFE: DataContractSerializer with known types
DataContractSerializer serializer = new DataContractSerializer(typeof(SafeDTO));
SafeDTO obj = (SafeDTO)serializer.ReadObject(stream);

// SAFE: XmlSerializer
XmlSerializer serializer = new XmlSerializer(typeof(SafeDTO));
SafeDTO obj = (SafeDTO)serializer.Deserialize(stream);

// SAFE: JSON.Net with TypeNameHandling.None
JsonConvert.DeserializeObject<SafeDTO>(json, new JsonSerializerSettings {
    TypeNameHandling = TypeNameHandling.None
});

// SAFE: System.Text.Json (default is safe)
SafeDTO obj = JsonSerializer.Deserialize<SafeDTO>(json);
```

#### Known Gadgets

- `ObjectDataProvider`
- `AssemblyInstaller`
- `PSObject` (PowerShell)
- `TypeConfuseDelegate`

### PHP

#### Dangerous Patterns

```php
// VULNERABLE: unserialize with user input
$obj = unserialize($_GET['data']);  // RCE via __wakeup, __destruct

// VULNERABLE: Object injection
class User {
    public function __destruct() {
        // Attacker can control $this->file
        unlink($this->file);
    }
}
```

#### Safe Alternatives

```php
// SAFE: JSON
$data = json_decode($input, true);  // true for associative array

// SAFE: unserialize with allowed_classes
$obj = unserialize($data, ['allowed_classes' => ['SafeClass']]);

// SAFE: Explicit parsing
$data = json_decode($input, true);
$user = new User();
$user->name = $data['name'] ?? '';
```

### Ruby

#### Dangerous Patterns

```ruby
# VULNERABLE: Marshal.load
obj = Marshal.load(untrusted_data)

# VULNERABLE: YAML.load (unsafe by default)
obj = YAML.load(untrusted_data)

# VULNERABLE: JSON with create_additions
obj = JSON.parse(data, create_additions: true)
```

#### Safe Alternatives

```ruby
# SAFE: JSON without additions
data = JSON.parse(untrusted_data)  # Default is safe

# SAFE: YAML.safe_load
data = YAML.safe_load(untrusted_data)

# SAFE: Explicit permitted classes
data = YAML.safe_load(untrusted_data, permitted_classes: [Date, Time])
```

### Node.js

#### Dangerous Patterns

```javascript
// VULNERABLE: node-serialize
var serialize = require('node-serialize');
var obj = serialize.unserialize(untrustedData);

// VULNERABLE: js-yaml (unsafe by default in older versions)
var yaml = require('js-yaml');
var obj = yaml.load(untrustedData);  // Can execute code

// VULNERABLE: eval-based parsing
var obj = eval('(' + untrustedData + ')');
```

#### Safe Alternatives

```javascript
// SAFE: JSON.parse
const obj = JSON.parse(untrustedData);

// SAFE: js-yaml with safeLoad or safe schema
const yaml = require('js-yaml');
const obj = yaml.load(untrustedData, { schema: yaml.SAFE_SCHEMA });

// SAFE: Explicit validation with Joi/Zod
const Joi = require('joi');
const schema = Joi.object({ name: Joi.string().required() });
const { value, error } = schema.validate(JSON.parse(input));
```

---

## General Prevention Strategies

### 1. Avoid Native Serialization

```python
# Instead of pickle, use JSON with schema validation
import json
from pydantic import BaseModel

class UserData(BaseModel):
    name: str
    email: str

data = UserData(**json.loads(untrusted_input))
```

### 2. Sign Serialized Data

```python
import hmac
import hashlib
import json

SECRET_KEY = b'your-secret-key'

def serialize_with_signature(data):
    json_data = json.dumps(data)
    signature = hmac.new(SECRET_KEY, json_data.encode(), hashlib.sha256).hexdigest()
    return f"{json_data}:{signature}"

def deserialize_with_verification(signed_data):
    json_data, signature = signed_data.rsplit(':', 1)
    expected = hmac.new(SECRET_KEY, json_data.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid signature")

    return json.loads(json_data)
```

### 3. Type-Restricted Deserialization

```java
// Jackson with explicit type
ObjectMapper mapper = new ObjectMapper();
mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, true);

// Only deserialize to specific class
UserDTO user = mapper.readValue(json, UserDTO.class);
```

### 4. Input Validation

```python
import json
from jsonschema import validate

schema = {
    "type": "object",
    "properties": {
        "name": {"type": "string", "maxLength": 100},
        "age": {"type": "integer", "minimum": 0, "maximum": 150}
    },
    "required": ["name"],
    "additionalProperties": False
}

def safe_parse(data):
    parsed = json.loads(data)
    validate(instance=parsed, schema=schema)
    return parsed
```

---

## Grep Patterns for Detection

```bash
# Python
grep -rn "pickle\.load\|pickle\.loads\|cPickle" --include="*.py"
grep -rn "yaml\.load\|yaml\.unsafe_load" --include="*.py"
grep -rn "marshal\.load\|shelve\.open" --include="*.py"

# Java
grep -rn "ObjectInputStream\|XMLDecoder\|XStream" --include="*.java"
grep -rn "readObject\|fromXML" --include="*.java"

# .NET
grep -rn "BinaryFormatter\|NetDataContractSerializer\|ObjectStateFormatter" --include="*.cs"
grep -rn "TypeNameHandling\." --include="*.cs" | grep -v "None"

# PHP
grep -rn "unserialize\s*\(" --include="*.php"

# Ruby
grep -rn "Marshal\.load\|YAML\.load" --include="*.rb"

# Node.js
grep -rn "unserialize\|node-serialize" --include="*.js"
```

---

## Testing for Deserialization Vulnerabilities

### Tools

- **ysoserial** (Java) - Generate gadget chain payloads
- **ysoserial.net** (.NET) - .NET gadget chains
- **phpggc** (PHP) - PHP gadget chains
- **pickle-payload** (Python) - Python pickle payloads

### Test Cases

1. Send serialized data from different languages
2. Test with common gadget chain payloads
3. Test with modified/corrupted serialized data
4. Test with nested/recursive objects (DoS)
5. Test with large objects (resource exhaustion)

---

## References

- [OWASP Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html)
- [CWE-502: Deserialization of Untrusted Data](https://cwe.mitre.org/data/definitions/502.html)
- [ysoserial GitHub](https://github.com/frohoff/ysoserial)
- [Microsoft BinaryFormatter Security Guide](https://docs.microsoft.com/en-us/dotnet/standard/serialization/binaryformatter-security-guide)
