import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import EAPField from 'sentry/views/alerts/rules/metric/eapField';

describe('EAPField', () => {
  it('renders', () => {
    const {project} = initializeOrg();
    render(
      <EAPField
        aggregate={'count(span.duration)'}
        onChange={() => {}}
        project={project}
      />
    );
    screen.getByText('count');
    screen.getByText('span.duration');
  });

  it('should call onChange with the new aggregate string when switching aggregates', async () => {
    const {project} = initializeOrg();
    const onChange = jest.fn();
    render(
      <EAPField
        aggregate={'count(span.duration)'}
        onChange={onChange}
        project={project}
      />
    );
    await userEvent.click(screen.getByText('count'));
    await userEvent.click(await screen.findByText('max'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('max(span.duration)', {}));
  });
});
