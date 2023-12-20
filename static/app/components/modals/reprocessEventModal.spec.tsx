import {Group as GroupFixture} from 'sentry-fixture/group';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {ReprocessingEventModal} from 'sentry/components/modals/reprocessEventModal';

const group = GroupFixture({
  id: '1337',
  pluginActions: [],
  pluginIssues: [],
});

describe('ReprocessEventModal', function () {
  it('form fields & info', function () {
    const {organization} = initializeOrg({
      organization: {
        id: '4660',
        slug: 'org',
        features: ['reprocessing-v2'],
      },
    });

    render(
      <ReprocessingEventModal
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        groupId="1337"
        organization={organization}
      />
    );

    // Reprocess impacts
    expect(
      screen.getByText(
        'Reprocessing applies new debug files and grouping enhancements to this Issue. Please consider these impacts:'
      )
    ).toBeInTheDocument();

    // Reprocess impacts list
    expect(screen.getAllByRole('listitem')).toHaveLength(3);

    // Docs info
    expect(
      screen.getByText(
        textWithMarkupMatcher('For more information, please refer to the documentation.')
      )
    ).toBeInTheDocument();

    // Number of events to be reprocessed field
    expect(
      screen.getByRole('spinbutton', {name: 'Number of events to be reprocessed'})
    ).toBeInTheDocument();

    // Remaining events action field
    expect(
      screen.getByRole('radiogroup', {name: 'Remaining events'})
    ).toBeInTheDocument();
  });

  it('reprocess all events', async function () {
    const {organization} = initializeOrg({
      organization: {
        id: '4660',
        slug: 'org',
        features: ['reprocessing-v2'],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/reprocessing/`,
      method: 'POST',
      body: [],
    });

    jest.spyOn(window.location, 'reload').mockImplementation(() => {});
    const handleCloseModal = jest.fn();

    render(
      <ReprocessingEventModal
        Body={ModalBody}
        closeModal={handleCloseModal}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
        groupId="1337"
        organization={organization}
      />
    );

    expect(screen.getByRole('heading', {name: 'Reprocess Events'})).toBeInTheDocument();

    // Number of events to be reprocessed field
    expect(
      screen.getByRole('spinbutton', {name: 'Number of events to be reprocessed'})
    ).toHaveAttribute('placeholder', 'Reprocess all events');

    await userEvent.click(screen.getByRole('button', {name: 'Reprocess Events'}));

    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
    expect(handleCloseModal).toHaveBeenCalled();
  });
});
