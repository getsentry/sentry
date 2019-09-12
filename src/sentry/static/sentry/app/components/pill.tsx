import React from 'react';
import styled from 'react-emotion';

import space from 'app/styles/space';

type PillProps = {
  name: string;
  value: string | boolean | undefined | null;
};

class Pill extends React.PureComponent<PillProps> {
  getRenderTypeAndValue = () => {
    const {value} = this.props;
    if (value === undefined) {
      return {};
    }

    let type: PillValueProps['type'];
    let renderValue: string | undefined;

    switch (value) {
      case 'true':
      case true:
        type = 'positive';
        renderValue = 'yes';
        break;
      case 'false':
      case false:
        type = 'negative';
        renderValue = 'no';
        break;
      case null:
      case undefined:
        type = 'negative';
        renderValue = 'n/a';
        break;
      default:
        renderValue = value.toString();
    }

    return {type, renderValue};
  };

  render() {
    const {name, children} = this.props;
    const {type, renderValue} = this.getRenderTypeAndValue();

    return (
      <StyledPill>
        <PillName>{name}</PillName>
        <PillValue type={type}>{children || renderValue}</PillValue>
      </StyledPill>
    );
  }
}

const StyledPill = styled('li')`
  white-space: nowrap;
  margin: 0 10px 10px 0;
  display: flex;
  border: 1px solid ${p => p.theme.gray1};
  border-radius: ${p => p.theme.button.borderRadius};
  box-shadow: ${p => p.theme.dropShadowLightest};
  line-height: 1.2;
  max-width: 100%;
  &:last-child {
    margin-right: 0;
  }
`;

const PillName = styled('span')`
  padding: ${space(0.5)} ${space(1)};
  min-width: 0;
  white-space: nowrap;
`;

type PillValueProps = {
  type: 'positive' | 'negative' | undefined;
};
const PillValue = styled(PillName)<PillValueProps>`
  ${p => {
    switch (p.type) {
      case 'positive':
        return `
          background: ${p.theme.greenLightest};
          border: 1px solid ${p.theme.green};
          margin: -1px;
        `;
      case 'negative':
        return `
          background: ${p.theme.redLightest};
          border: 1px solid ${p.theme.red};
          margin: -1px;
        `;
      default:
        return `
          background: ${p.theme.whiteDark};
        `;
    }
  }}

  border-left: 1px solid ${p => p.theme.gray1};
  border-radius: ${p =>
    `0 ${p.theme.button.borderRadius} ${p.theme.button.borderRadius} 0`};
  font-family: ${p => p.theme.text.familyMono};
  max-width: 100%;

  > a {
    max-width: 100%;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    display: inline-block;
    vertical-align: text-bottom;
  }

  .pill-icon,
  .external-icon {
    display: inline;
    margin: 0 0 0 ${space(1)};
    color: ${p => p.theme.gray2};
    line-height: 1.2;
    &:hover {
      color: ${p => p.theme.gray4};
    }
  }
`;

export default Pill;
