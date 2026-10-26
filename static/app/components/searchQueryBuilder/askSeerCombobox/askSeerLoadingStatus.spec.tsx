import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AskSeerLoadingStatus} from './askSeerLoadingStatus';

const getStatus = () => screen.getByRole('status');

it('shows a generic status before the first step arrives', () => {
  render(<AskSeerLoadingStatus completedSteps={[]} currentStep={null} />);

  expect(getStatus()).toHaveTextContent("I'm on it...");
  expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
});

it('shows only the current step', () => {
  render(
    <AskSeerLoadingStatus
      completedSteps={[{key: 'execute_query'}]}
      currentStep={{key: 'get_field_values'}}
    />
  );

  expect(getStatus()).toHaveTextContent('Investigating your tags...');
  expect(getStatus()).not.toHaveTextContent('Fine-tuned query');
});

it('shows a status for metric candidate discovery', () => {
  render(
    <AskSeerLoadingStatus
      completedSteps={[]}
      currentStep={{key: 'get_metric_candidates'}}
    />
  );

  expect(getStatus()).toHaveTextContent('Finding matching metrics...');
});

it('advances copy for repeated steps while deduplicating parallel calls', () => {
  render(
    <AskSeerLoadingStatus
      completedSteps={[
        {key: 'get_field_values,get_field_values'},
        {key: 'get_field_values'},
      ]}
      currentStep={{key: 'get_field_values'}}
    />
  );

  expect(getStatus()).toHaveTextContent('Looking for more tags...');
});
