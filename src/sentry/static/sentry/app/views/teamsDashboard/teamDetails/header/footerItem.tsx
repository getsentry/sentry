import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import space from 'app/styles/space';

type Props = {
  title: string;
  items?: Array<React.ReactElement>;
  children?: React.ReactElement;
};

const FooterItem = ({title, items = [], children}: Props) => {
  const renderContent = () => {
    if (items.length === 0) {
      return children;
    }

    return (
      <Items>
        {items.map((item, index) => (
          <Item key={index}>{item}</Item>
        ))}
      </Items>
    );
  };

  return (
    <Wrapper>
      <Title>{title}</Title>
      {renderContent()}
    </Wrapper>
  );
};

export default FooterItem;

FooterItem.propTypes = {
  items: PropTypes.array,
};

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-rows: auto 1fr;
`;

const Title = styled('div')`
  color: ${p => p.theme.gray600};
  text-transform: uppercase;
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Items = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  grid-gap: ${space(1)};
`;

const Item = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeMedium};
  border: 1px solid ${p => p.theme.gray500};
  padding: ${space(0.25)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
`;
