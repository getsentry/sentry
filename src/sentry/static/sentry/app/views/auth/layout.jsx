import React from 'react';

const BODY_CLASSES = ['narrow', 'auth', 'org-login'];

class AuthLayout extends React.Component {
  componentDidMount() {
    document.body.classList.add(...BODY_CLASSES);
  }

  componentWillUnmount() {
    document.body.classList.remove(...BODY_CLASSES);
  }

  render() {
    const {children} = this.props;
    return (
      <React.Fragment>
        <div className="app">
          <div className="container">
            <div className="pattern-bg" />

            <div className="box">
              <div className="auth-sidebar">
                <a href="/">
                  <span className="icon-sentry-logo" />
                </a>
              </div>
              <section className="org-login">{children}</section>
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }
}
export default AuthLayout;
