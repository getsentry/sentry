"""
Shopify OAuth support.

You must:

- Register an App in the shopify partner control panel
- Add the API Key and shared secret in your django settings
- Set the Application URL in shopify app settings
- Install the shopify package

"""
import imp
from urllib2 import HTTPError

from django.contrib.auth import authenticate

from social_auth.utils import setting
from social_auth.backends import BaseOAuth2, OAuthBackend
from social_auth.exceptions import AuthFailed, AuthCanceled


class ShopifyBackend(OAuthBackend):
    """Shopify OAuth2 authentication backend"""
    name = 'shopify'
    # Default extra data to store
    EXTRA_DATA = [
        ('shop', 'shop'),
        ('website', 'website'),
        ('expires', 'expires')
    ]

    def get_user_details(self, response):
        """Use the shopify store name as the username"""
        return {
            'username': unicode(response.get('shop', '')
                                      .replace('.myshopify.com', ''))
        }

    def get_user_id(self, details, response):
        """OAuth providers return an unique user id in response"""
        # For shopify, we'll use the shop ID
        return response['shop']


class ShopifyAuth(BaseOAuth2):
    """Shopify OAuth authentication mechanism"""
    AUTH_BACKEND = ShopifyBackend
    SETTINGS_KEY_NAME = 'SHOPIFY_APP_API_KEY'
    SETTINGS_SECRET_NAME = 'SHOPIFY_SHARED_SECRET'
    # Look at http://api.shopify.com/authentication.html#scopes
    SCOPE_VAR_NAME = 'SHOPIFY_SCOPE'

    def __init__(self, request, redirect):
        super(ShopifyAuth, self).__init__(request, redirect)
        fp, pathname, description = imp.find_module('shopify')
        self.shopifyAPI = imp.load_module('shopify', fp, pathname, description)

    def auth_url(self):
        self.shopifyAPI.Session.setup(api_key=setting('SHOPIFY_APP_API_KEY'),
                                      secret=setting('SHOPIFY_SHARED_SECRET'))
        scope = self.get_scope()
        state = self.state_token()
        self.request.session[self.AUTH_BACKEND.name + '_state'] = state

        redirect_uri = self.get_redirect_uri(state)
        permission_url = self.shopifyAPI.Session.create_permission_url(
            self.request.GET.get('shop').strip(),
            scope=scope, redirect_uri=redirect_uri
        )
        return permission_url

    def auth_complete(self, *args, **kwargs):
        """Completes login process, must return user instance"""
        access_token = None
        if self.data.get('error'):
            error = self.data.get('error_description') or self.data['error']
            raise AuthFailed(self, error)

        client_id, client_secret = self.get_key_and_secret()
        try:
            shop_url = self.request.GET.get('shop')
            self.shopifyAPI.Session.setup(
                api_key=setting('SHOPIFY_APP_API_KEY'),
                secret=setting('SHOPIFY_SHARED_SECRET')
            )
            shopify_session = self.shopifyAPI.Session(shop_url,
                                                      self.request.REQUEST)
            access_token = shopify_session.token
        except self.shopifyAPI.ValidationException, e:
            raise AuthCanceled(self)
        except HTTPError, e:
            if e.code == 400:
                raise AuthCanceled(self)
            else:
                raise

        if not access_token:
            raise AuthFailed(self, 'Authentication Failed')
        return self.do_auth(access_token, shop_url, shopify_session.url,
                            *args, **kwargs)

    def do_auth(self, access_token, shop_url, website, *args, **kwargs):
        kwargs.update({
            'auth': self,
            'response': {
                'shop': shop_url,
                'website': 'http://%s' % website,
                'access_token': access_token
            },
            self.AUTH_BACKEND.name: True
        })
        return authenticate(*args, **kwargs)

    @classmethod
    def enabled(cls):
        """Return backend enabled status by checking basic settings"""
        return setting('SHOPIFY_APP_API_KEY') and \
               setting('SHOPIFY_SHARED_SECRET')


# Backend definition
BACKENDS = {
    'shopify': ShopifyAuth,
}
