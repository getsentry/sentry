import {initializeOrg} from 'sentry-test/initializeOrg';
import {renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {DebugImageDetails} from 'sentry/components/events/interfaces/debugMeta/debugImageDetails';

describe('Debug Meta - Image Details', function () {
  const eventEntryDebugMeta = TestStubs.EventEntryDebugMeta();
  const event = TestStubs.Event({entries: [eventEntryDebugMeta]});
  const {organization, project} = initializeOrg();

  beforeAll(function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/files/dsyms/?debug_id=${eventEntryDebugMeta.data.images[0].debug_id}`,
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/builtin-symbol-sources/`,
      method: 'GET',
      body: [],
    });
  });

  it('Candidates correctly sorted', function () {
    renderGlobalModal();

    openModal(modalProps => (
      <DebugImageDetails
        {...modalProps}
        organization={organization}
        image={eventEntryDebugMeta.data.images[0]}
        projSlug={project.slug}
        event={event}
        onReprocessEvent={jest.fn()}
      />
    ));

    // Check status order.
    // The UI shall sort the candidates by status. However, this sorting is not alphabetical but in the following order:
    // Permissions -> Failed -> Ok -> Deleted (previous Ok) -> Unapplied -> Not Found
    const statusColumns = screen
      .getAllByTestId('status')
      .map(statusColumn => statusColumn.textContent);
    expect(statusColumns).toEqual(['Failed', 'Failed', 'Failed', 'Deleted']);

    // const informationColumn = candidates.find('InformationColumn');

    // Check source names order.
    // The UI shall sort the candidates by source name (alphabetical)
    const sourceNames = screen
      .getAllByTestId('source-name')
      .map(sourceName => sourceName.textContent);
    expect(sourceNames).toEqual(['America', 'Austria', 'Belgium', 'Sentry']);

    // Check location order.
    // The UI shall sort the candidates by source location (alphabetical)
    const locations = screen
      .getAllByTestId('filename-or-location')
      .map(location => location.textContent);
    // Only 3 results are returned, as the UI only displays the Location component
    // when the location is defined and when it is not internal
    expect(locations).toEqual(['arizona', 'burgenland', 'brussels']);
  });
});
