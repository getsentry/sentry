import {render, screen} from '@testing-library/react';

import {IconParenthesis} from './iconParenthesis';

it('uses the standard icon size', () => {
  render(<IconParenthesis aria-label="Parenthesis" />);

  expect(screen.getByRole('img', {name: 'Parenthesis'})).toHaveAttribute('width', '16px');
  expect(screen.getByRole('img', {name: 'Parenthesis'})).toHaveAttribute(
    'height',
    '16px'
  );
});
