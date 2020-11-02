import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import Button from 'app/components/button';
import {IconChevron} from 'app/icons';

import Rules from './rules';
import {Rule} from './types';

type Props = {
  rules: Array<Rule>;
};

type State = {
  isCollapsed: boolean;
  contentHeight?: string;
};

class OrganizationRules extends React.Component<Props, State> {
  state: State = {
    isCollapsed: true,
  };

  componentDidUpdate() {
    this.loadContentHeight();
  }

  rulesRef = React.createRef<HTMLUListElement>();

  loadContentHeight() {
    if (!this.state.contentHeight) {
      const contentHeight = this.rulesRef.current?.offsetHeight;
      if (contentHeight) {
        this.setState({contentHeight: `${contentHeight}px`});
      }
    }
  }

  handleToggleCollapsed = () => {
    this.setState(prevState => ({
      isCollapsed: !prevState.isCollapsed,
    }));
  };

  render() {
    const {rules} = this.props;
    const {isCollapsed, contentHeight} = this.state;

    if (rules.length === 0) {
      return (
        <Wrapper>
          {t('There are no data scrubbing rules at the organization level')}
        </Wrapper>
      );
    }
    return (
      <Wrapper isCollapsed={isCollapsed} contentHeight={contentHeight}>
        <Header onClick={this.handleToggleCollapsed}>
          <div>{t('Organization Rules')}</div>
          <Button
            title={
              isCollapsed
                ? t('Expand Organization Rules')
                : t('Collapse Organization Rules')
            }
            icon={<IconChevron size="xs" direction={isCollapsed ? 'down' : 'up'} />}
            size="xsmall"
          />
        </Header>
        <Content>
          <Rules rules={rules} ref={this.rulesRef} disabled />
        </Content>
      </Wrapper>
    );
  }
}

export default OrganizationRules;

const Content = styled('div')`
  transition: height 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  height: 0;
  overflow: hidden;
`;

const Header = styled('div')`
  cursor: pointer;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
`;

const Wrapper = styled('div')<{isCollapsed?: boolean; contentHeight?: string}>`
  color: ${p => p.theme.gray400};
  background: ${p => p.theme.gray100};
  ${p => !p.contentHeight && `padding: ${space(1)} ${space(2)}`};
  ${p => !p.isCollapsed && ` border-bottom: 1px solid ${p.theme.border}`};
  ${p =>
    !p.isCollapsed &&
    p.contentHeight &&
    `
      ${Content} {
        height: ${p.contentHeight};
      }
    `}
`;
