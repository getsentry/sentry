import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';

type DefaultProps = {
  maxVisibleItems: number;
  fadeHeight: string;
};

type Props = DefaultProps & {
  children: React.ReactNode[];
  className?: string;
};

type State = {
  collapsed: boolean;
};

// TODO(matej): refactor to reusable component

class clippedHealthRows extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    maxVisibleItems: 5,
    fadeHeight: '40px',
  };

  state: State = {
    collapsed: true,
  };

  reveal = () => {
    this.setState({collapsed: false});
  };

  collapse = () => {
    this.setState({collapsed: true});
  };

  render() {
    const {children, maxVisibleItems, fadeHeight, className} = this.props;
    const {collapsed} = this.state;

    return (
      <Wrapper className={className}>
        {children.map((item, index) => {
          if (!collapsed || index < maxVisibleItems) {
            return item;
          }

          if (index === maxVisibleItems) {
            return (
              <ShowMoreWrapper fadeHeight={fadeHeight} key="show-more">
                <Button
                  onClick={this.reveal}
                  priority="primary"
                  size="xsmall"
                  data-test-id="show-more"
                >
                  {tct('Show [numberOfFrames] More', {
                    numberOfFrames: children.length - maxVisibleItems,
                  })}
                </Button>
              </ShowMoreWrapper>
            );
          }
          return null;
        })}

        {!collapsed && children.length > maxVisibleItems && (
          <CollapseWrapper>
            <Button
              onClick={this.collapse}
              priority="primary"
              size="xsmall"
              data-test-id="collapse"
            >
              {t('Collapse')}
            </Button>
          </CollapseWrapper>
        )}
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')`
  position: relative;
`;

const ShowMoreWrapper = styled('div')<{fadeHeight: string}>`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: linear-gradient(180deg, hsla(0, 0%, 100%, 0.15) 0, #fff);
  background-repeat: repeat-x;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: ${space(1)} solid #fff;
  border-top: ${space(1)} solid transparent;
  height: ${p => p.fadeHeight};
`;

const CollapseWrapper = styled('div')`
  text-align: center;
  padding: ${space(0.25)} 0 ${space(1)} 0;
`;

export default clippedHealthRows;
