import {Component} from 'react';
import styled from '@emotion/styled';

import {IconSentry} from 'app/icons';
import Link from 'app/components/links/link';
import Panel from 'app/components/panels/panel';
import space from 'app/styles/space';

const BODY_CLASSES = ['narrow'];

class Layout extends Component {
  componentDidMount() {
    document.body.classList.add(...BODY_CLASSES);
  }

  componentWillUnmount() {
    document.body.classList.remove(...BODY_CLASSES);
  }

  render() {
    const {children} = this.props;
    return (
      <div className="app">
        <AuthContainer>
          <div className="pattern-bg" />
          <AuthPanel>
            <AuthSidebar>
              <SentryButton />
            </AuthSidebar>
            <div>{children}</div>
          </AuthPanel>
        </AuthContainer>
      </div>
    );
  }
}

const AuthContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 5vh;
`;

const AuthPanel = styled(Panel)`
  min-width: 550px;
  display: inline-grid;
  grid-template-columns: 60px 1fr;
`;

const AuthSidebar = styled('div')`
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: ${space(3)};
  border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};
  margin: -1px;
  margin-right: 0;
  background: #564f64;
  background-image: linear-gradient(
    -180deg,
    rgba(52, 44, 62, 0) 0%,
    rgba(52, 44, 62, 0.5) 100%
  );
`;

const SentryButton = styled(p => (
  <Link to="/" {...p}>
    <IconSentry size="24px" />
  </Link>
))`
  color: #fff;

  &:hover,
  &:focus {
    color: #fff;
  }
`;

export default Layout;
