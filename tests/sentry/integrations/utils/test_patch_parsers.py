from sentry.integrations.utils.patch_parsers import PythonPatch
from sentry.testutils.cases import TestCase


class PythonPatchTestCase(TestCase):
    def test_simple(self):
        patch = """@@ -120,6 +120,9 @@ def create_member(self, *args, **kwargs):
     def create_api_key(self, *args, **kwargs):
         return Factories.create_api_key(*args, **kwargs)

+    def create_user_auth_token(self, *args, **kwargs):
+        return Factories.create_user_auth_token(*args, **kwargs)
+
     def create_team_membership(self, *args, **kwargs):
         return Factories.create_team_membership(*args, **kwargs)

@@ -269,6 +272,9 @@ def create_internal_integration(self, *args, **kwargs):
     def create_internal_integration_token(self, *args, **kwargs):
         return Factories.create_internal_integration_token(*args, **kwargs)

+    def create_org_auth_token(self, *args, **kwargs):
+        return Factories.create_org_auth_token(*args, **kwargs)
+
     def create_sentry_app_installation(self, *args, **kwargs):
         return Factories.create_sentry_app_installation(*args, **kwargs)"""

        functions = PythonPatch().extract_from_patch(patch=patch)

        assert len(functions) == 2
        assert "create_member" in functions
        assert "create_internal_integration" in functions

    def test_avoids_duplicates(self):
        patch = """@@ -10,6 +10,9 @@ def create_member(self, *args, **kwargs):
     def create_api_key(self, *args, **kwargs):
         return Factories.create_api_key(*args, **kwargs)

+    def create_user_auth_token(self, *args, **kwargs):
+        return Factories.create_user_auth_token(*args, **kwargs)
+
     def create_team_membership(self, *args, **kwargs):
         return Factories.create_team_membership(*args, **kwargs)

@@ -69,6 +72,9 @@ def create_member(self, *args, **kwargs):
     def create_internal_integration_token(self, *args, **kwargs):
         return Factories.create_internal_integration_token(*args, **kwargs)

+    def create_org_auth_token(self, *args, **kwargs):
+        return Factories.create_org_auth_token(*args, **kwargs)
+
     def create_sentry_app_installation(self, *args, **kwargs):
         return Factories.create_sentry_app_installation(*args, **kwargs)"""
        functions = PythonPatch().extract_from_patch(patch=patch)

        assert len(functions) == 1
        assert "create_member" in functions
