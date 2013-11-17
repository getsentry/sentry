# -*- coding:utf-8 -*-
from __future__ import unicode_literals
from unittest import skipUnless
from django.conf import settings
from django.core.urlresolvers import reverse
from django.test.testcases import LiveServerTestCase, SimpleTestCase
from django.test.utils import override_settings
from selenium.webdriver.firefox.webdriver import WebDriver
from selenium.webdriver.support.ui import WebDriverWait
from social_auth.backends.contrib.odnoklassniki import odnoklassniki_oauth_sig
from social_auth.models import UserSocialAuth
import time
        
class SignatureTest(SimpleTestCase):
    def test_oauth_signature(self):
        data = {'access_token': 'cq240efje3pd0gdXUmrvvMaHyb-74XQi8',
                'application_key': 'CBAJLNABABABABABA',
                'method': 'users.getCurrentUser',
                'format': 'JSON'}
        secret = '31D6095131175A7C9656EC2C'
        signature = '755fe7af274abbe545916039eb428c98'
        self.assertEqual(odnoklassniki_oauth_sig(data, secret), signature)

class OdnoklassnikiLiveTest(LiveServerTestCase):
    @classmethod
    def setUpClass(cls):
        cls.selenium = WebDriver()
        super(OdnoklassnikiLiveTest, cls).setUpClass()

    @classmethod
    def tearDownClass(cls):
        super(OdnoklassnikiLiveTest, cls).tearDownClass()
        cls.selenium.quit()
        
    def get_odnoklassniki_name(self):
        raise NotImplementedError('This method is part of interface, but should be implemented in subclass')

class BaseOdnoklassnikiAppTest(OdnoklassnikiLiveTest):
    @skipUnless(hasattr(settings, 'ODNOKLASSNIKI_APP_ID'), 
                "You need to have ODNOKLASSNIKI_APP_ID in settings to test iframe app")
    @skipUnless(hasattr(settings, 'ODNOKLASSNIKI_SANDBOX_DEV_USERNAME'),
                "You need to have ODNOKLASSNIKI_SANDBOX_DEV_USERNAME in settings to test iframe app")
    @skipUnless(hasattr(settings, 'ODNOKLASSNIKI_SANDBOX_DEV_PASSWORD'),
                "You need to have ODNOKLASSNIKI_SANDBOX_DEV_PASSWORD in settings to test iframe app")
    def setUp(self):
        self.app_id = settings.ODNOKLASSNIKI_APP_ID
        self.dev_username = settings.ODNOKLASSNIKI_SANDBOX_DEV_USERNAME
        self.dev_password = settings.ODNOKLASSNIKI_SANDBOX_DEV_PASSWORD
        self.get_odnoklassniki_name()
        
    def sandbox_login(self):
        WebDriverWait(self.selenium, 3).until(lambda ff: ff.find_element_by_name('j_username'))
        dev_username_input = self.selenium.find_element_by_name('j_username')
        dev_username_input.send_keys(self.dev_username)
        dev_password_input = self.selenium.find_element_by_name('j_password')
        dev_password_input.send_keys(self.dev_password)
        self.selenium.find_element_by_name('actionId').click()
        
    def sandbox_logout(self):
        self.selenium.get('http://api-sandbox.odnoklassniki.ru:8088/sandbox/logout.do')
        WebDriverWait(self.selenium, 3).until(lambda ff: ff.find_element_by_name('j_username'))
        
    def get_odnoklassniki_name(self):
        self.selenium.get('http://api-sandbox.odnoklassniki.ru:8088/sandbox/protected/main.do')
        self.sandbox_login()
        WebDriverWait(self.selenium, 3).until(lambda ff: ff.find_element_by_tag_name('fieldset'))
        self.odnoklassniki_name = self.selenium.find_element_by_xpath('//*[@id="command"]/fieldset/table/tbody/tr[2]/td[2]').text
        self.sandbox_logout()
        
    def login_into_sandbox(self):
        self.selenium.get('http://api-sandbox.odnoklassniki.ru:8088/sandbox/protected/application/launch.do?appId={0:s}&userId=0'.format(self.app_id))
        self.sandbox_login()
        WebDriverWait(self.selenium, 3).until(lambda ff: ff.find_element_by_tag_name('iframe'))
        time.sleep(1)
        
class OdnoklassnikiAppTest(BaseOdnoklassnikiAppTest):
    def test_auth(self):
        self.login_into_sandbox()
        self.assertEquals(UserSocialAuth.objects.count(), 1)
        social_auth = UserSocialAuth.objects.get()
        user = social_auth.user
        full_name = '{0} {1}'.format(user.first_name, user.last_name) 
        self.assertEquals(full_name, self.odnoklassniki_name)
        self.assertTrue('apiconnection' in social_auth.extra_data)
        self.assertTrue('api_server' in social_auth.extra_data)
        
class OdnoklassnikiAppTestExtraData(BaseOdnoklassnikiAppTest):
    @override_settings(ODNOKLASSNIKI_APP_EXTRA_USER_DATA_LIST = ('gender', 'birthday', 'age'))        
    def test_extra_data(self):
        self.login_into_sandbox()
        self.assertEquals(UserSocialAuth.objects.count(), 1)
        social_user = UserSocialAuth.objects.get()
        user = social_user.user
        full_name = '{0} {1}'.format(user.first_name, user.last_name) 
        self.assertEquals(full_name, self.odnoklassniki_name)
        self.assertTrue(all([field in social_user.extra_data for field in ('gender', 'birthday', 'age')]))

class OdnoklassnikiOAuthTest(OdnoklassnikiLiveTest):
    @skipUnless(hasattr(settings, "ODNOKLASSNIKI_OAUTH2_CLIENT_KEY"),
                "You need to have ODNOKLASSNIKI_OAUTH2_CLIENT_KEY in settings to test odnoklassniki OAuth")
    @skipUnless(hasattr(settings, "ODNOKLASSNIKI_TEST_USERNAME"),
                "You need to have ODNOKLASSNIKI_TEST_USERNAME in settings to test odnoklassniki OAuth")
    @skipUnless(hasattr(settings, "ODNOKLASSNIKI_TEST_PASSWORD"),
                "You need to have ODNOKLASSNIKI_TEST_PASSWORD in settings to test odnoklassniki OAuth")
    def setUp(self):
        self.username = settings.ODNOKLASSNIKI_TEST_USERNAME
        self.password = settings.ODNOKLASSNIKI_TEST_PASSWORD
        self.get_odnoklassniki_name()
    
    def get_odnoklassniki_name(self):
        #Load login page
        self.selenium.get('http://www.odnoklassniki.ru/')
        WebDriverWait(self.selenium, 3).until(lambda ff: ff.find_element_by_id('field_email'))
        email_input = self.selenium.find_element_by_id('field_email')
        email_input.send_keys(self.username)
        pw_input = self.selenium.find_element_by_id('field_password')
        pw_input.send_keys(self.password)
        self.selenium.find_element_by_id('hook_FormButton_button_go').click()
        #Submit form, wait for successful login
        name_css_sel = '#hook_Block_MiddleColumnTopCardUser .mctc_name>a.mctc_nameLink'
        WebDriverWait(self.selenium, 2).until(lambda ff: ff.find_element_by_css_selector(name_css_sel))
        self.odnoklassniki_name = self.selenium.find_element_by_css_selector(name_css_sel).text
        #Remember the name of logged user
        link = [el for el in self.selenium.find_elements_by_css_selector('.portal-headline__login__link') if el.text == 'выход']
        self.assertTrue(len(link) == 1)
        link[0].click()
        #Click on logout link to show logout popup
        WebDriverWait(self.selenium, 2).until(lambda ff: ff.find_element_by_id('hook_Form_PopLayerLogoffUserForm') and ff.find_element_by_id('hook_Form_PopLayerLogoffUserForm').is_displayed())
        self.selenium.find_element_by_css_selector('#hook_FormButton_button_logoff').click()
        #Click logout popup and wait for the login form be shown
        WebDriverWait(self.selenium, 2).until(lambda ff: ff.find_element_by_id('field_email'))
        
    def login_into_odnoklassniki(self):
        url = reverse('socialauth_begin', args=('odnoklassniki',))
        self.selenium.get('{0:s}{1:s}'.format(self.live_server_url, url))
        WebDriverWait(self.selenium, 2).until(lambda ff: ff.find_element_by_id('field_email'))
        email_input = self.selenium.find_element_by_id('field_email')
        pw_input = self.selenium.find_element_by_id('field_password')
        email_input.send_keys(self.username)
        pw_input.send_keys(self.password)
        self.selenium.find_element_by_name('button_continue').click()
        WebDriverWait(self.selenium, 2).until(lambda ff: ff.find_element_by_name('button_accept_request'))
        self.selenium.find_element_by_name('button_accept_request').click()
        self.selenium.implicitly_wait(2)
        time.sleep(1)#We need this for the server to close database connection
        #If this line is removed, following line will fail

    def test_auth(self):
        self.login_into_odnoklassniki()
        self.assertEquals(UserSocialAuth.objects.count(), 1)
        user = UserSocialAuth.objects.get().user
        full_name = '{0} {1}'.format(user.first_name, user.last_name) 
        self.assertEquals(full_name, self.odnoklassniki_name)

