import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ProblemSection} from './problemSection';

describe('ProblemSection', () => {
  it('renders supplied rich content and fields in their given order', () => {
    render(
      <ProblemSection
        summary={
          <Stack gap="sm">
            <Text>Repeated work increases cost.</Text>
            <Text bold>Review this operation.</Text>
          </Stack>
        }
        fields={[
          {key: 'operation', label: 'Operation', value: 'process_batch'},
          {key: 'count', label: 'Calls', value: 0},
          {key: 'cost', label: 'Estimated cost', value: '$12.34', emphasized: true},
        ]}
      >
        <Text>Additional evidence</Text>
      </ProblemSection>
    );

    expect(screen.getByText('Repeated work increases cost.')).toBeInTheDocument();
    expect(screen.getByText('Review this operation.')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Additional evidence')).toBeInTheDocument();
    const values = screen.getAllByText(/^(process_batch|0|\$12\.34)$/);
    expect(values.map(value => value.textContent)).toEqual([
      'process_batch',
      '0',
      '$12.34',
    ]);
  });

  it('keeps a linked value and its tooltip separately accessible', async () => {
    render(
      <ProblemSection
        summary="Review the affected operation."
        fields={[
          {
            key: 'operation',
            label: 'Operation',
            value: 'process_batch',
            link: '/explore/traces/',
            tooltip: 'Open the supporting spans.',
          },
        ]}
      />
    );

    const link = screen.getByRole('link', {name: 'process_batch'});
    expect(link).toHaveAttribute('href', '/explore/traces/');
    expect(within(link).queryByLabelText('More information')).not.toBeInTheDocument();

    await userEvent.tab();
    expect(link).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('More information')).toHaveFocus();
    expect(await screen.findByText('Open the supporting spans.')).toBeInTheDocument();
  });

  it('supports an explanation with no available fields', () => {
    render(<ProblemSection summary="Supporting data is unavailable." fields={[]} />);

    expect(screen.getByText('Supporting data is unavailable.')).toBeInTheDocument();
  });
});
