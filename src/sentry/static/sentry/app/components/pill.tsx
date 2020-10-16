import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

enum PILL_TYPE {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
}

type Props = {
  name: string;
  value: string | boolean | undefined | null;
  children?: React.ReactNode;
};

const Pill = React.memo(({name, value, children}: Props) => {
  const getTypeAndValue = (): Partial<{type: PILL_TYPE; renderValue: string}> => {
    if (value === undefined) {
      return {};
    }

    switch (value) {
      case 'true':
      case true:
        return {
          type: PILL_TYPE.POSITIVE,
          renderValue: 'true',
        };
      case 'false':
      case false:
        return {
          type: PILL_TYPE.NEGATIVE,
          renderValue: 'false',
        };
      case null:
      case undefined:
        return {
          type: PILL_TYPE.NEGATIVE,
          renderValue: 'n/a',
        };
      default:
        return {
          type: undefined,
          renderValue: String(value),
        };
    }
  };

  const {type, renderValue} = getTypeAndValue();

  return (
    <StyledPill type={type}>
      <PillName>{name}</PillName>
      <PillValue>{children ?? renderValue}</PillValue>
    </StyledPill>
  );
});

const getPillBorder = ({type, theme}: {type?: PILL_TYPE; theme: Theme}) => {
  switch (type) {
    case PILL_TYPE.POSITIVE:
      return `
        background: ${theme.green100};
        border: 1px solid ${theme.green400};
      `;
    case PILL_TYPE.NEGATIVE:
      return `
        background: ${theme.red100};
        border: 1px solid ${theme.red400};
      `;
    default:
      return '';
  }
};

const getPillValueColor = ({type, theme}: {type?: PILL_TYPE; theme: Theme}) => {
  switch (type) {
    case PILL_TYPE.POSITIVE:
      return `
        border-left-color: ${theme.green400};
      `;
    case PILL_TYPE.NEGATIVE:
      return `
        border-left-color: ${theme.red400};
      `;
    default:
      return `background: ${theme.gray100};`;
  }
};

const PillName = styled('span')`
  padding: ${space(0.5)} ${space(1)};
  min-width: 0;
  white-space: nowrap;
  display: flex;
  align-items: center;
`;

const PillValue = styled(PillName)`
  border-left: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p =>
    `0 ${p.theme.button.borderRadius} ${p.theme.button.borderRadius} 0`};
  font-family: ${p => p.theme.text.familyMono};
  max-width: 100%;
  display: flex;
  align-items: center;

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
    color: ${p => p.theme.gray500};
    &:hover {
      color: ${p => p.theme.gray700};
    }
  }
`;

const StyledPill = styled('li')<{type?: PILL_TYPE}>`
  white-space: nowrap;
  margin: 0 10px 10px 0;
  display: flex;
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.button.borderRadius};
  box-shadow: ${p => p.theme.dropShadowLightest};
  line-height: 1.2;
  max-width: 100%;
  :last-child {
    margin-right: 0;
  }

  ${getPillBorder};

  ${PillValue} {
    ${getPillValueColor};
  }
`;

export default Pill;
