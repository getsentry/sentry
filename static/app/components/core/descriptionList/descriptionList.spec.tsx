import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DescriptionList} from '@sentry/scraps/descriptionList';

describe('DescriptionList', () => {
  it('renders terms and details as a description list when composed with its parts', () => {
    render(
      <DescriptionList data-test-id="list">
        <DescriptionList.Term>Occurred</DescriptionList.Term>
        <DescriptionList.Details>Jan 1, 2026</DescriptionList.Details>
      </DescriptionList>
    );

    expect(screen.getByTestId('list').tagName).toBe('DL');
    expect(screen.getByRole('term')).toHaveTextContent('Occurred');
    expect(screen.getByRole('definition')).toHaveTextContent('Jan 1, 2026');
  });

  it('does not forward the gap prop to the DOM when one is provided', () => {
    render(<DescriptionList gap="xs" data-test-id="list" />);

    expect(screen.getByTestId('list')).not.toHaveAttribute('gap');
  });

  it('does not forward the nowrap prop to the DOM when one is provided', () => {
    render(<DescriptionList nowrap data-test-id="list" />);

    expect(screen.getByTestId('list')).not.toHaveAttribute('nowrap');
  });
});
