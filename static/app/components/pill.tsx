import {memo} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type PillType = 'positive' | 'negative' | 'error';

type Props = {
  children?: React.ReactNode;
  className?: string;
  name?: React.ReactNode;
  type?: PillType;
  value?: number | string | boolean | null;
};

const Pill = memo(({name, value, children, type, className}: Props) => {
  const getTypeAndValue = (): Partial<{renderValue: string; valueType: PillType}> => {
    if (value === undefined) {
      return {};
    }

    switch (value) {
      case 'true':
      case true:
        return {
          valueType: 'positive',
          renderValue: 'true',
        };
      case 'false':
      case false:
        return {
          valueType: 'negative',
          renderValue: 'false',
        };
      case null:
      case undefined:
        return {
          valueType: 'error',
          renderValue: 'n/a',
        };
      default:
        return {
          valueType: undefined,
          renderValue: String(value),
        };
    }
  };

  const {valueType, renderValue} = getTypeAndValue();

  return (
    <StyledPill type={type ?? valueType} className={className}>
      <PillName>{name}</PillName>
      <PillValue>{children ?? renderValue}</PillValue>
    </StyledPill>
  );
});

const getPillStyle = ({type, theme}: {theme: Theme; type?: PillType}) => {
  switch (type) {
    case 'error':
      return css`
        background: ${theme.colors.red100};
        border: 1px solid ${theme.colors.red400};
      `;
    default:
      return css`
        border: 1px solid ${theme.tokens.border.primary};
      `;
  }
};

const getPillValueStyle = ({type, theme}: {theme: Theme; type?: PillType}) => {
  switch (type) {
    case 'positive':
      return css`
        background: ${theme.colors.green100};
        border: 1px solid ${theme.colors.green400};
        font-family: ${theme.text.familyMono};
        margin: -1px;
      `;
    case 'error':
      return css`
        background: ${theme.colors.red100};
        border: 1px solid ${theme.colors.red400};
        margin: -1px;
      `;
    case 'negative':
      return css`
        background: ${theme.colors.red100};
        border: 1px solid ${theme.colors.red400};
        font-family: ${theme.text.familyMono};
        margin: -1px;
      `;
    default:
      return css`
        background: ${theme.backgroundSecondary};
        font-family: ${theme.text.familyMono};
      `;
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
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => `0 ${p.theme.radius.md} ${p.theme.radius.md} 0`};
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
    color: ${p => p.theme.subText};
    &:hover {
      color: ${p => p.theme.tokens.content.primary};
    }
  }
`;

const StyledPill = styled('li')<{type?: PillType}>`
  white-space: nowrap;
  margin: 0 ${space(1)} ${space(1)} 0;
  display: flex;
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowLight};
  line-height: 1.2;
  max-width: 100%;
  :last-child {
    margin-right: 0;
  }

  ${getPillStyle};

  ${PillValue} {
    ${getPillValueStyle};
  }
`;

export default Pill;
