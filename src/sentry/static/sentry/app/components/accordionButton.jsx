import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import {Flex} from 'grid-emotion';
import Badge from 'app/components/badge';

class AccordionButton extends React.Component {
  static propTypes = {
    onClick: PropTypes.func,
    open: PropTypes.bool,
    count: PropTypes.number,
  };

  render() {
    const {style, className, count, onClick, open} = this.props;
    return (
      <StyledButton style={style} className={className} onClick={onClick} open={open}>
        <Flex align="center" justify="space-between" w={1}>
          <Flex align="center">
            {this.props.children}
            {count && <Badge style={{marginLeft: space(0.25)}} text={count} />}
          </Flex>
          <StyledInlineSvg src="icon-chevron-down" open={open} />
        </Flex>
      </StyledButton>
    );
  }
}

const StyledButton = styled('a')`
  display: block;
  width: 100%;
  box-shadow: ${p => (p.open ? 'inset -2px 2px rgba(0,0,0,0.04)' : null)};
  background: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.offWhite2};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)} ${space(1.5)};
  color: ${p => p.theme.gray4};

  &:hover {
    color: ${p => p.theme.gray5};
    background: ${p => p.theme.offWhite2};
    border-color: ${p => p.theme.gray1};
  }
`;

const StyledInlineSvg = styled(InlineSvg)`
  transform: rotate(${p => (p.open ? '180deg' : null)});
`;

export default AccordionButton;
