from __future__ import absolute_import

EXAMPLE_PRIVATE_KEY = """-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgQC1cd9t8sA03awggLiX2gjZxyvOVUPJksLly1E662tttTeR3Wm9
eo6onNeI8HRD+O4wubUp4h4Chc7DtLDmFEPhUZ8Qkwztiifm99Xo3s0nUq4Pygp5
AU09KXTEPbzHLh1dnXLcxVLmGDE4drh0NWmYsd/Zp7XNIZq2TRQQ3NTdVQIDAQAB
AoGAFwMyS0eWiR30TssEnn3Q0Y4pSCoYRuCOR4bZ7pcdMPTi72UdnCKHJWt/Cqc0
l8piq1tiVsWO+NLvvnKUXRoE4cAyrGrpf1F0uP5zYW71SQALc9wwsjDzuj7BZEuK
fg35JSceLHWE1WtzPDX5Xg20YPnMrA/xe/RwuPjuBH0wSqECQQDizzmKdKCq0ejy
3OxEto5knqpSEgRcOk0HDsdgjwkwiZJOj5ECV2FKpNHuu2thGy/aDJyLlmUso8j0
OpvLAzOvAkEAzMwAgGexTxKm8hy3ilvVn9EvhSKjaIakqY4ONK9LZ4zMiDHI0H6C
FXlwWX7CJM0YVFMubj8SB8rnIuvFDEBMOwJABHtRyMGbNyTktH/XD1iIIcbc2LhQ
a74fLYeGOws4hEQDpxfBJsmxO3dcSppbedS+slFTepKjNymZW/IYh/9tMwJAEL5E
9DqGBn7x4y1x2//yESTbC7lvPqZzY+FXS/tg4NBkEGZxkoolPHg3NTnlyXhzGsHK
M/04DicKipJYA85l7QJAJ3u67qZXecM/oWTtJToBDuyKGHfdY1564+RbyDEjJJRb
vz4O/8FQQ1sGjdEBMMrRBCHEG8o3/XDTrB97t45TeA==
-----END RSA PRIVATE KEY-----"""

EXAMPLE_ISSUE_SEARCH = """
{
  "expand": "names,schema",
  "startAt": 0,
  "maxResults": 50,
  "total": 1,
  "issues": [
    {
      "expand": "",
      "id": "10001",
      "self": "http://www.example.com/jira/rest/api/2/issue/10001",
      "key": "HSP-1",
      "fields": {
        "summary": "this is a test issue summary"
      }
    }
  ],
  "warningMessages": [
    "The value 'splat' does not exist for the field 'Foo'."
  ]
}
"""

EXAMPLE_USER_SEARCH_RESPONSE = """
[
    {"name": "bob", "displayName": "Bobby", "emailAddress": "bob@example.org"}
]
"""
