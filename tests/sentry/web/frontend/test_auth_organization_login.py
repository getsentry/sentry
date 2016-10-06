from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import AuthIdentity, AuthProvider, OrganizationMember
from sentry.testutils import AuthProviderTestCase


# TODO(dcramer): this is an integration test
class OrganizationAuthLoginTest(AuthProviderTestCase):
    def test_renders_basic_login_form(self):
        organization = self.create_organization(name='foo', owner=self.user)

        path = reverse('sentry-auth-organization', args=[organization.slug])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-login.html')

        assert resp.context['form']
        assert 'provider_key' not in resp.context
        assert resp.context['CAN_REGISTER']

    def test_renders_session_expire_message(self):
        organization = self.create_organization(name='foo', owner=self.user)
        path = reverse('sentry-auth-organization', args=[organization.slug])

        self.client.cookies['session_expired'] = '1'
        resp = self.client.get(path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/organization-login.html')
        assert len(resp.context['messages']) == 1

    def test_flow_as_anonymous(self):
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )

        path = reverse('sentry-auth-organization', args=[organization.slug])

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode('utf-8')

        path = reverse('sentry-auth-sso')

        resp = self.client.post(path, {'email': 'foo@example.com'})

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-identity.html')
        assert resp.status_code == 200

        resp = self.client.post(path, {'op': 'newuser'})

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

        auth_identity = AuthIdentity.objects.get(
            auth_provider=auth_provider,
        )

        user = auth_identity.user
        assert user.email == 'foo@example.com'
        assert not user.has_usable_password()
        assert user.is_managed

        member = OrganizationMember.objects.get(
            organization=organization,
            user=user,
        )

        assert getattr(member.flags, 'sso:linked')
        assert not getattr(member.flags, 'sso:invalid')

    def test_flow_as_existing_user_with_new_account(self):
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )
        user = self.create_user('bar@example.com')

        path = reverse('sentry-auth-organization', args=[organization.slug])

        self.login_as(user)

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode('utf-8')

        path = reverse('sentry-auth-sso')

        resp = self.client.post(path, {'email': 'foo@example.com'})

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-link.html')
        assert resp.status_code == 200

        resp = self.client.post(path, {'op': 'confirm'})

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

        auth_identity = AuthIdentity.objects.get(
            auth_provider=auth_provider,
        )

        assert user == auth_identity.user

        member = OrganizationMember.objects.get(
            organization=organization,
            user=user,
        )

        assert getattr(member.flags, 'sso:linked')
        assert not getattr(member.flags, 'sso:invalid')

    def test_flow_as_existing_identity(self):
        organization = self.create_organization(name='foo', owner=self.user)
        user = self.create_user('bar@example.com')
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )
        AuthIdentity.objects.create(
            auth_provider=auth_provider,
            user=user,
            ident='foo@example.com',
        )

        path = reverse('sentry-auth-organization', args=[organization.slug])

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode('utf-8')

        path = reverse('sentry-auth-sso')

        resp = self.client.post(path, {'email': 'foo@example.com'})

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

    def test_flow_as_unauthenticated_existing_matched_user_no_merge(self):
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )
        user = self.create_user('bar@example.com')

        path = reverse('sentry-auth-organization', args=[organization.slug])

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode('utf-8')

        path = reverse('sentry-auth-sso')

        resp = self.client.post(path, {'email': user.email})

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-identity.html')
        assert resp.status_code == 200
        assert resp.context['existing_user'] == user
        assert resp.context['login_form']

        resp = self.client.post(path, {'op': 'newuser'})

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

        auth_identity = AuthIdentity.objects.get(
            auth_provider=auth_provider,
        )

        new_user = auth_identity.user
        assert user.email == 'bar@example.com'
        assert new_user != user

        member = OrganizationMember.objects.get(
            organization=organization,
            user=new_user,
        )

        assert getattr(member.flags, 'sso:linked')
        assert not getattr(member.flags, 'sso:invalid')

    def test_flow_as_unauthenticated_existing_matched_user_with_merge(self):
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )
        user = self.create_user('bar@example.com')

        path = reverse('sentry-auth-organization', args=[organization.slug])

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode('utf-8')

        path = reverse('sentry-auth-sso')

        resp = self.client.post(path, {'email': user.email})

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-identity.html')
        assert resp.status_code == 200
        assert resp.context['existing_user'] == user
        assert resp.context['login_form']

        resp = self.client.post(path, {
            'op': 'login',
            'username': user.username,
            'password': 'admin',
        })

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-link.html')
        assert resp.status_code == 200

        resp = self.client.post(path, {'op': 'confirm'})

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

        auth_identity = AuthIdentity.objects.get(
            auth_provider=auth_provider,
        )

        new_user = auth_identity.user
        assert new_user == user

        member = OrganizationMember.objects.get(
            organization=organization,
            user=user,
        )

        assert getattr(member.flags, 'sso:linked')
        assert not getattr(member.flags, 'sso:invalid')

    def test_flow_as_unauthenticated_existing_unmatched_user_with_merge(self):
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )
        user = self.create_user('foo@example.com')

        path = reverse('sentry-auth-organization', args=[organization.slug])

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode('utf-8')

        path = reverse('sentry-auth-sso')

        resp = self.client.post(path, {'email': 'bar@example.com'})

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-identity.html')
        assert resp.status_code == 200
        assert not resp.context['existing_user']
        assert resp.context['login_form']

        resp = self.client.post(path, {
            'op': 'login',
            'username': user.username,
            'password': 'admin',
        })

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-link.html')
        assert resp.status_code == 200

        resp = self.client.post(path, {'op': 'confirm'})

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

        auth_identity = AuthIdentity.objects.get(
            auth_provider=auth_provider,
        )

        new_user = auth_identity.user
        assert new_user == user

        member = OrganizationMember.objects.get(
            organization=organization,
            user=user,
        )

        assert getattr(member.flags, 'sso:linked')
        assert not getattr(member.flags, 'sso:invalid')

    def test_flow_as_unauthenticated_existing_matched_user_with_merge_and_existing_identity(self):
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )
        user = self.create_user('bar@example.com')

        auth_identity = AuthIdentity.objects.create(
            auth_provider=auth_provider,
            user=user,
            ident='adfadsf@example.com'
        )

        path = reverse('sentry-auth-organization', args=[organization.slug])

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode('utf-8')

        path = reverse('sentry-auth-sso')

        resp = self.client.post(path, {'email': user.email})

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-identity.html')
        assert resp.status_code == 200
        assert resp.context['existing_user'] == user
        assert resp.context['login_form']

        resp = self.client.post(path, {
            'op': 'login',
            'username': user.username,
            'password': 'admin',
        })

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-link.html')
        assert resp.status_code == 200

        resp = self.client.post(path, {'op': 'confirm'})

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

        auth_identity = AuthIdentity.objects.get(
            id=auth_identity.id,
        )

        assert auth_identity.ident == user.email

        new_user = auth_identity.user
        assert new_user == user

        member = OrganizationMember.objects.get(
            organization=organization,
            user=user,
        )

        assert getattr(member.flags, 'sso:linked')
        assert not getattr(member.flags, 'sso:invalid')

    def test_flow_as_unauthenticated_existing_inactive_user_with_merge_and_existing_identity(self):
        """
        Given an unauthenticated user, and an existing, inactive user account
        with a linked identity, this should claim that identity and create
        a new user account.
        """
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )
        user = self.create_user('bar@example.com', is_active=False)

        auth_identity = AuthIdentity.objects.create(
            auth_provider=auth_provider,
            user=user,
            ident='adfadsf@example.com'
        )

        path = reverse('sentry-auth-organization', args=[organization.slug])

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode('utf-8')

        path = reverse('sentry-auth-sso')

        resp = self.client.post(path, {'email': 'adfadsf@example.com'})

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-identity.html')
        assert resp.status_code == 200
        assert not resp.context['existing_user']
        assert resp.context['login_form']

        resp = self.client.post(path, {
            'op': 'newuser',
        })

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

        auth_identity = AuthIdentity.objects.get(
            id=auth_identity.id,
        )

        assert auth_identity.ident == 'adfadsf@example.com'

        new_user = auth_identity.user
        assert new_user != user

        member = OrganizationMember.objects.get(
            organization=organization,
            user=new_user,
        )

        assert getattr(member.flags, 'sso:linked')
        assert not getattr(member.flags, 'sso:invalid')

    def test_flow_managed_duplicate_users_with_membership(self):
        """
        Given an existing authenticated user, and an updated identity (e.g.
        the ident changed from the SSO provider), we should be re-linking
        the identity automatically (without prompt) assuming the user is
        a member of the org.
        """
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )

        # setup a 'previous' identity, such as when we migrated Google from
        # the old idents to the new
        user = self.create_user('bar@example.com', is_active=False, is_managed=True)
        auth_identity = AuthIdentity.objects.create(
            auth_provider=auth_provider,
            user=user,
            ident='bar@example.com'
        )

        # they must be a member for the auto merge to happen
        self.create_member(
            organization=organization,
            user=user,
        )

        # user needs to be logged in
        self.login_as(user)

        path = reverse('sentry-auth-organization', args=[organization.slug])

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode('utf-8')

        path = reverse('sentry-auth-sso')

        # we're suggesting the identity changed (as if the Google ident was
        # updated to be something else)
        resp = self.client.post(path, {'email': 'adfadsf@example.com'})

        # there should be no prompt as we auto merge the identity
        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

        auth_identity = AuthIdentity.objects.get(
            id=auth_identity.id,
        )

        assert auth_identity.ident == 'adfadsf@example.com'

        new_user = auth_identity.user
        assert new_user == user

        member = OrganizationMember.objects.get(
            organization=organization,
            user=new_user,
        )

        assert getattr(member.flags, 'sso:linked')
        assert not getattr(member.flags, 'sso:invalid')

    def test_flow_managed_duplicate_users_without_membership(self):
        """
        Given an existing authenticated user, and an updated identity (e.g.
        the ident changed from the SSO provider), we should be prompting to
        confirm their identity as they dont have membership.
        """
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )

        # setup a 'previous' identity, such as when we migrated Google from
        # the old idents to the new
        user = self.create_user('bar@example.com', is_active=False, is_managed=True)
        AuthIdentity.objects.create(
            auth_provider=auth_provider,
            user=user,
            ident='bar@example.com'
        )

        # user needs to be logged in
        self.login_as(user)

        path = reverse('sentry-auth-organization', args=[organization.slug])

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode('utf-8')

        path = reverse('sentry-auth-sso')

        # we're suggesting the identity changed (as if the Google ident was
        # updated to be something else)
        resp = self.client.post(path, {'email': 'adfadsf@example.com'})

        self.assertTemplateUsed(resp, 'sentry/auth-confirm-link.html')
        assert resp.status_code == 200
        assert resp.context['existing_user'] == user

    def test_swapped_identities(self):
        """
        Given two existing user accounts with mismatched identities, such as:

        - foo SSO'd as bar@example.com
        - bar SSO'd as foo@example.com

        If bar is authenticating via SSO as bar@example.com, we should remove
        the existing entry attached to bar, and re-bind the entry owned by foo.
        """
        organization = self.create_organization(name='foo', owner=self.user)
        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )

        # setup a 'previous' identity, such as when we migrated Google from
        # the old idents to the new
        user = self.create_user('bar@example.com', is_active=False, is_managed=True)
        identity1 = AuthIdentity.objects.create(
            auth_provider=auth_provider,
            user=user,
            ident='bar@example.com'
        )

        # create another identity which is used, but not by the authenticating
        # user
        user2 = self.create_user('adfadsf@example.com', is_active=False, is_managed=True)
        identity2 = AuthIdentity.objects.create(
            auth_provider=auth_provider,
            user=user2,
            ident='adfadsf@example.com'
        )
        member2 = self.create_member(user=user2, organization=organization)

        # user needs to be logged in
        self.login_as(user)

        path = reverse('sentry-auth-organization', args=[organization.slug])

        resp = self.client.post(path)

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode('utf-8')

        path = reverse('sentry-auth-sso')

        # we're suggesting the identity changed (as if the Google ident was
        # updated to be something else)
        resp = self.client.post(path, {'email': 'adfadsf@example.com'})

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

        assert not AuthIdentity.objects.filter(
            id=identity1.id,
        ).exists()

        identity2 = AuthIdentity.objects.get(
            id=identity2.id,
        )

        assert identity2.ident == 'adfadsf@example.com'
        assert identity2.user == user

        member1 = OrganizationMember.objects.get(
            user=user,
            organization=organization,
        )
        assert getattr(member1.flags, 'sso:linked')
        assert not getattr(member1.flags, 'sso:invalid')

        member2 = OrganizationMember.objects.get(id=member2.id)
        assert not getattr(member2.flags, 'sso:linked')
        assert getattr(member2.flags, 'sso:invalid')
