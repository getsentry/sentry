import selectEvent from 'react-select-event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {convertRelayPiiConfig} from 'sentry/views/settings/components/dataScrubbing/convertRelayPiiConfig';
import Edit from 'sentry/views/settings/components/dataScrubbing/modals/edit';
import submitRules from 'sentry/views/settings/components/dataScrubbing/submitRules';
import {MethodType, RuleType} from 'sentry/views/settings/components/dataScrubbing/types';
import {
  getMethodLabel,
  getRuleLabel,
  valueSuggestions,
} from 'sentry/views/settings/components/dataScrubbing/utils';

const relayPiiConfig = TestStubs.DataScrubbingRelayPiiConfig();
const stringRelayPiiConfig = JSON.stringify(relayPiiConfig);
const organizationSlug = 'sentry';
const convertedRules = convertRelayPiiConfig(stringRelayPiiConfig);
const rules = convertedRules;
const rule = rules[2];
const projectId = 'foo';
const endpoint = `/projects/${organizationSlug}/${projectId}/`;
const api = new MockApiClient();

jest.mock('sentry/views/settings/components/dataScrubbing/submitRules');

describe('Edit Modal', function () {
  it('open Edit Rule Modal', async function () {
    const handleCloseModal = jest.fn();

    render(
      <Edit
        Body={ModalBody}
        closeModal={handleCloseModal}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={jest.fn()}
        rule={rule}
      />
    );

    expect(
      screen.getByRole('heading', {name: 'Edit an advanced data scrubbing rule'})
    ).toBeInTheDocument();

    // Method Field
    expect(screen.getByText('Method')).toBeInTheDocument();
    userEvent.hover(screen.getAllByTestId('more-information')[0]);
    expect(await screen.findByText('What to do')).toBeInTheDocument();
    userEvent.click(screen.getByText('Replace'));

    Object.values(MethodType)
      .filter(method => method !== MethodType.REPLACE)
      .forEach(method => {
        expect(screen.getByText(getMethodLabel(method).label)).toBeInTheDocument();
      });

    // Placeholder Field
    expect(screen.getByText('Custom Placeholder (Optional)')).toBeInTheDocument();
    userEvent.hover(screen.getAllByTestId('more-information')[1]);
    expect(
      await screen.findByText('It will replace the default placeholder [Filtered]')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('[Filtered]')).toBeInTheDocument();

    // Type Field
    expect(screen.getByText('Data Type')).toBeInTheDocument();
    userEvent.hover(screen.getAllByTestId('more-information')[2]);
    expect(
      await screen.findByText(
        'What to look for. Use an existing pattern or define your own using regular expressions.'
      )
    ).toBeInTheDocument();
    userEvent.click(screen.getAllByText('Regex matches')[0]);

    Object.values(RuleType)
      .filter(ruleType => ruleType !== RuleType.PATTERN)
      .forEach(ruleType => {
        expect(screen.getByText(getRuleLabel(ruleType))).toBeInTheDocument();
      });

    userEvent.click(screen.getAllByText('Regex matches')[0]);

    // Regex matches Field
    expect(screen.getAllByText('Regex matches')).toHaveLength(2);
    userEvent.hover(screen.getAllByTestId('more-information')[3]);
    expect(
      await screen.findByText('Custom regular expression (see documentation)')
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Regex matches'})).toHaveAttribute(
      'placeholder',
      '[a-zA-Z0-9]+'
    );

    // Event ID
    expect(
      screen.getByRole('button', {name: 'Use event ID for auto-completion'})
    ).toBeInTheDocument();

    // Source Field
    expect(screen.getByText('Source')).toBeInTheDocument();
    userEvent.hover(screen.getAllByTestId('more-information')[4]);
    expect(
      await screen.findByText(
        'Where to look. In the simplest case this can be an attribute name.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Source'})).toHaveAttribute(
      'placeholder',
      'Enter a custom attribute, variable or header name'
    );

    // Close Modal
    userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(handleCloseModal).toHaveBeenCalled();
  });

  it('edit Rule Modal', async function () {
    render(
      <Edit
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={jest.fn()}
        rule={rule}
      />
    );

    // Method Field
    await selectEvent.select(screen.getByText('Replace'), 'Mask');

    // Placeholder Field should be now hidden
    expect(screen.queryByText('Custom Placeholder (Optional)')).not.toBeInTheDocument();

    // Type Field
    await selectEvent.select(screen.getAllByText('Regex matches')[0], 'Anything');

    // Regex Field should be now hidden
    expect(screen.queryByText('Regex matches')).not.toBeInTheDocument();

    // Source Field
    userEvent.clear(screen.getByRole('textbox', {name: 'Source'}));
    userEvent.type(
      screen.getByRole('textbox', {name: 'Source'}),
      valueSuggestions[2].value
    );

    // Save rule
    userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    expect(submitRules).toHaveBeenCalledWith(api, endpoint, [
      {
        id: 0,
        method: 'replace',
        type: 'password',
        source: 'password',
        placeholder: 'Scrubbed',
      },
      {id: 1, method: 'mask', type: 'creditcard', source: '$message'},
      {
        id: 2,
        method: 'mask',
        pattern: '',
        placeholder: '',
        type: 'anything',
        source: valueSuggestions[2].value,
      },
    ]);
  });
});
