import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {convertRelayPiiConfig} from 'sentry/views/settings/components/dataScrubbing/convertRelayPiiConfig';
import Add from 'sentry/views/settings/components/dataScrubbing/modals/add';
import {MethodType, RuleType} from 'sentry/views/settings/components/dataScrubbing/types';
import {
  getMethodLabel,
  getRuleLabel,
} from 'sentry/views/settings/components/dataScrubbing/utils';

const relayPiiConfig = DataScrubbingRelayPiiConfigFixture();
const stringRelayPiiConfig = JSON.stringify(relayPiiConfig);
const organizationSlug = 'sentry';
const rules = convertRelayPiiConfig(stringRelayPiiConfig);
const successfullySaved = jest.fn();
const projectId = 'foo';
const endpoint = `/projects/${organizationSlug}/${projectId}/`;
const api = new MockApiClient();

describe('Add Modal', function () {
  it('open Add Rule Modal', async function () {
    const handleCloseModal = jest.fn();

    render(
      <Add
        Header={makeClosableHeader(handleCloseModal)}
        Body={ModalBody}
        Footer={ModalFooter}
        closeModal={handleCloseModal}
        CloseButton={makeCloseButton(handleCloseModal)}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={successfullySaved}
      />
    );

    expect(
      screen.getByRole('heading', {name: 'Add an advanced data scrubbing rule'})
    ).toBeInTheDocument();

    // Method Field
    expect(screen.getByText('Method')).toBeInTheDocument();

    await userEvent.hover(screen.getAllByTestId('more-information')[0]!);
    expect(await screen.findByText('What to do')).toBeInTheDocument();

    await userEvent.click(screen.getByText(getMethodLabel(MethodType.MASK).label));

    Object.values(MethodType).forEach(method => {
      if (method === MethodType.MASK) {
        return;
      }
      expect(screen.getByText(getMethodLabel(method).label)).toBeInTheDocument();
    });

    // Type Field
    expect(screen.getByText('Data Type')).toBeInTheDocument();

    await userEvent.hover(screen.getAllByTestId('more-information')[1]!);
    expect(
      await screen.findByText(
        'What to look for. Use an existing pattern or define your own using regular expressions.'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText(getRuleLabel(RuleType.CREDITCARD)));

    Object.values(RuleType).forEach(rule => {
      if (rule === RuleType.CREDITCARD) {
        return;
      }
      expect(screen.getByText(getRuleLabel(rule))).toBeInTheDocument();
    });

    // Event ID
    expect(
      screen.getByRole('button', {name: 'Use event ID for auto-completion'})
    ).toBeInTheDocument();

    // Source Field
    screen.getByRole('textbox', {name: 'Source'});

    await userEvent.hover(screen.getAllByTestId('more-information')[2]!);

    expect(
      await screen.findByText(
        'Where to look. In the simplest case this can be an attribute name.'
      )
    ).toBeInTheDocument();

    // Close Modal
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(handleCloseModal).toHaveBeenCalled();
  });

  it('Display placeholder field', async function () {
    render(
      <Add
        Header={makeClosableHeader(jest.fn())}
        Body={ModalBody}
        Footer={ModalFooter}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={successfullySaved}
      />
    );

    expect(screen.queryByText('Custom Placeholder (Optional)')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(getMethodLabel(MethodType.MASK).label));

    await userEvent.keyboard('{arrowdown}{arrowdown}{enter}');

    expect(screen.getByText('Custom Placeholder (Optional)')).toBeInTheDocument();

    expect(screen.getByPlaceholderText('[Filtered]')).toBeInTheDocument();

    await userEvent.hover(screen.getAllByTestId('more-information')[1]!);

    expect(
      await screen.findByText('It will replace the default placeholder [Filtered]')
    ).toBeInTheDocument();
  });

  it('Display regex field', async function () {
    render(
      <Add
        Header={makeClosableHeader(jest.fn())}
        Body={ModalBody}
        Footer={ModalFooter}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={successfullySaved}
      />
    );

    expect(screen.queryByText('Regex matches')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(getRuleLabel(RuleType.CREDITCARD)));

    await userEvent.keyboard(
      '{arrowdown}{arrowdown}{arrowdown}{arrowdown}{arrowdown}{arrowdown}{enter}'
    );

    expect(screen.getAllByText('Regex matches')).toHaveLength(2);

    expect(screen.getByPlaceholderText('[a-zA-Z0-9]+')).toBeInTheDocument();

    await userEvent.hover(screen.getAllByTestId('more-information')[2]!);

    expect(
      await screen.findByText('Custom regular expression (see documentation)')
    ).toBeInTheDocument();
  });

  it('Display Event Id', async function () {
    const eventId = '12345678901234567890123456789012';

    MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/data-scrubbing-selector-suggestions/`,
      body: {
        suggestions: [
          {type: 'value', examples: ['34359738368'], value: "extra.'system.cpu.memory'"},
          {type: 'value', value: '$frame.abs_path'},
        ],
      },
    });

    render(
      <Add
        Header={makeClosableHeader(jest.fn())}
        Body={ModalBody}
        Footer={ModalFooter}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        projectId={projectId}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organizationSlug}
        onSubmitSuccess={successfullySaved}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Use event ID for auto-completion'})
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    expect(screen.getAllByRole('listitem')).toHaveLength(18);

    expect(screen.getByText('Event ID (Optional)')).toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText('XXXXXXXXXXXXXX'),
      `${eventId}{enter}`
    );

    expect(await screen.findByTestId('icon-check-mark')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
