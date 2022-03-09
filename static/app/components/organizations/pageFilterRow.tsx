import {useRef} from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import space from 'sentry/styles/space';
import {domId} from 'sentry/utils/domId';

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
  const rowId = useRef(domId('page_filter_row'));

  const checkbox = (
    <MultiselectCheckbox
      isDisabled={!multi}
      isChecked={checked}
      onClick={multi ? onCheckClick : undefined}
      aria-labelledby={rowId.current}
    />
  );

  return (
    <Container aria-checked={checked} isChecked={checked} {...props}>
      <Label id={rowId.current} multi={multi}>
        {children}
      </Label>
      {renderCheckbox({checkbox, checked})}
    </Container>
  );
}

const MultiselectCheckbox = styled(CheckboxFancy)`
  position: relative;
  margin: 0 ${space(1)};

  /* Make the hitbox of the checkbox a bit larger */
  &:after {
    content: '';
    position: absolute;
    top: -${space(2)};
    right: -${space(2)};
    bottom: -${space(2)};
    left: -${space(2)};
  }
`;

const Container = styled('div')<{isChecked: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 400;
  padding-left: ${space(0.5)};
  height: ${p => p.theme.headerSelectorRowHeight}px;
  flex-shrink: 0;

  ${MultiselectCheckbox} {
    opacity: ${p => (p.isChecked ? 1 : 0.33)};
  }

  &:hover ${MultiselectCheckbox} {
    opacity: 1;
  }
`;

const Label = styled('div')<{multi: boolean}>`
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

export default PageFilterRow;
