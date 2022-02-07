import * as React from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import space from 'sentry/styles/space';

const defaultRenderCheckbox = ({checkbox}) => checkbox;

type CheckboxRenderOptions = {
  checkbox: React.ReactNode;
  checked?: boolean;
};

type Props = {
  checked: boolean;
  children: React.ReactNode;
  onCheckClick: (event: React.MouseEvent) => void;
  multi?: boolean;
  /**
   * This is a render prop which may be used to augment the checkbox rendered
   * to the right of the row. It will receive the default `checkbox` as a
   * prop along with the `checked` boolean.
   */
  renderCheckbox?: (options: CheckboxRenderOptions) => React.ReactNode;
};

function PageFilterRow({
  checked,
  onCheckClick,
  children,
  multi = true,
  renderCheckbox = defaultRenderCheckbox,
  ...props
}: Props) {
  const checkbox = <CheckboxFancy isDisabled={!multi} isChecked={checked} />;

  return (
    <Container isChecked={checked} {...props}>
      <Content multi={multi}>{children}</Content>
      <CheckboxHitbox onClick={multi ? onCheckClick : undefined}>
        {renderCheckbox({checkbox, checked})}
      </CheckboxHitbox>
    </Container>
  );
}

const Container = styled('div')<{isChecked: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 400;
  padding-left: ${space(0.5)};
  height: ${p => p.theme.headerSelectorRowHeight}px;
  flex-shrink: 0;

  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.33)};
  }

  &:hover ${CheckboxFancy} {
    opacity: 1;
  }
`;

const Content = styled('div')<{multi: boolean}>`
  display: flex;
  flex-shrink: 1;
  overflow: hidden;
  align-items: center;
  height: 100%;
  flex-grow: 1;
  user-select: none;

  &:hover {
    text-decoration: ${p => (p.multi ? 'underline' : null)};
    color: ${p => (p.multi ? p.theme.blue300 : null)};
  }
`;

const CheckboxHitbox = styled('div')`
  margin: 0 -${space(1)} 0 0; /* pushes the click box to be flush with the edge of the menu */
  padding: 0 ${space(1.5)};
  height: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

export default PageFilterRow;
