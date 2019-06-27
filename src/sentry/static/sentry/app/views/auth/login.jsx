import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

import AuthLoginForm from './loginForm';
import AuthSsoForm from './ssoForm';

class AuthLogin extends React.Component {
  static propTypes = {
    api: PropTypes.object,
  };

  state = {
    activeTab: 'login',
    canRegister: false,
    githubLoginLink: '',
    vstsLoginLink: '',
    warning: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  handleSetTab = (activeTab, event) => {
    this.setState({activeTab});
    event.preventDefault();
  };

  async fetchData() {
    const {api} = this.props;
    try {
      const response = await api.requestPromise('/auth/login/');
      this.setState({
        serverHostname: response.serverHostname,
        githubLoginLink: response.github_login_link,
        vstsLoginLink: response.vsts_login_link,
        canRegister: response.canRegister,
        warning: response.warning,
      });
    } catch (e) {
      // Swallow as this isn't critical stuff.
    }
  }

  renderRegister() {
    return null;
    /*
    return (

    <div class="tab-pane{% if op == "register" %} active{% endif %}" id="register">
      <div class="auth-container">
        <div class="auth-form-column">
          <form class="form-stacked" action="" method="post" autocomplete="off">
            {% csrf_token %}

            <input type="hidden" name="op" value="register" />

            {{ register_form|as_crispy_errors }}

            {% for field in register_form %}
              {% if not field.name == 'subscribe' %}
                {{ field|as_crispy_field }}
              {% endif %}
            {% endfor %}

            {% if register_form.subscribe %}
              {% with register_form.subscribe as field %}
                <fieldset class="{% if field.errors %}is-invalid{% endif %} boolean-radio-select">
                  <label> {{ field.label }}</label>
                  <div class="help-block">{{ field.help_text }}</div>
                  <div class="inputs-list radio">
                    {{ field }}
                    {% if field.errors %}
                      {% for error in field.errors %}
                        <p class="form-text"><small>{{ error }}</small></p>
                      {% endfor %}
                    {% endif %}
                  </div>
                </fieldset>
              {% endwith %}
            {% endif %}

            <div class="auth-footer m-t-1">
              <button type="submit" class="btn btn-primary">{% trans "Continue" %}</button>
              <a class="secondary" href="https://sentry.io/privacy/" target="_blank">
                {% trans "Privacy Policy" %}
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
    );
    */
  }

  render() {
    const {
      activeTab,
      serverHostname,
      canRegister,
      githubLoginLink,
      vstsLoginLink,
    } = this.state;
    const {api} = this.props;
    return (
      <React.Fragment>
        <div className="auth-container p-t-1 border-bottom">
          <h3>{t('Sign in to continue')}</h3>
          <ul className="nav nav-tabs auth-toggle m-b-0">
            <li className={activeTab === 'login' ? 'active' : ''}>
              <a href="#login" onClick={e => this.handleSetTab('login', e)}>
                {t('Login')}
              </a>
            </li>
            {canRegister && (
              <li className={activeTab === 'register' ? 'active' : ''}>
                <a href="#register" onClick={e => this.handleSetTab('register', e)}>
                  {t('Register')}
                </a>
              </li>
            )}
            <li className={activeTab === 'sso' ? 'active' : ''}>
              <a href="#sso" onClick={e => this.handleSetTab('sso', e)}>
                {t('Single Sign-On')}
              </a>
            </li>
          </ul>
        </div>
        <div className="tab-content">
          {activeTab === 'login' && (
            <AuthLoginForm
              api={api}
              githubLoginLink={githubLoginLink}
              vstsLoginLink={vstsLoginLink}
            />
          )}
          {activeTab === 'sso' && <AuthSsoForm api={api} hostname={serverHostname} />}
          {activeTab === 'register' && this.renderRegister()}
        </div>
      </React.Fragment>
    );
  }
}
export default withApi(AuthLogin);
