import React from 'react';
import styled from '@emotion/styled';

import {Theme} from 'app/utils/theme';
import space from 'app/styles/space';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  priority?: keyof Theme['badge'] | keyof Theme['alert'];
  size?: string;
  icon?: string | React.ReactNode;
  border?: boolean;
  inline?: boolean;
};

type StyleFuncProps = Props & {theme: Theme};

/**
 * Get priority from alerts or badge styles
 */
const getPriority = (p: StyleFuncProps) => {
  if (p.priority) {
    return p.theme.alert[p.priority] ?? p.theme.badge[p.priority] ?? null;
  }

  return null;
};

const getMarginLeft = (p: StyleFuncProps) =>
  p.inline ? `margin-left: ${p.size === 'small' ? '0.25em' : '0.5em'};` : '';

const getBorder = (p: StyleFuncProps) =>
  p.border ? `border: 1px solid ${getPriority(p)?.border ?? p.theme.border};` : '';

const Tag = styled(
  ({
    children,
    icon,
    inline: _inline,
    priority: _priority,
    size: _size,
    border: _border,
    ...props
  }: Props) => (
    <div {...props}>
      {icon && (
        <IconWrapper>
          {React.isValidElement(icon) && React.cloneElement(icon, {size: 'xs'})}
        </IconWrapper>
      )}
      {children}
    </div>
  )
)`
  display: inline-flex;
  box-sizing: border-box;
  padding: ${p => (p.size === 'small' ? '0.1em 0.4em 0.2em' : '0.35em 0.8em 0.4em')};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  line-height: 1;
  color: ${p => (p.priority ? p.theme.white : p.theme.gray800)};
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  align-items: center;
  border-radius: ${p => (p.size === 'small' ? '0.25em' : '2em')};
  text-transform: lowercase;
  font-weight: ${p => (p.size === 'small' ? 'bold' : 'normal')};
  background: ${p => getPriority(p)?.background ?? p.theme.gray300};
  ${p => getBorder(p)};
  ${p => getMarginLeft(p)};
`;

const IconWrapper = styled('span')`
  margin-right: ${space(0.5)};
`;

export default Tag;
