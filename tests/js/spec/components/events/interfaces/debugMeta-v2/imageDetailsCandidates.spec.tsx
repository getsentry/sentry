import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {openModal} from 'app/actionCreators/modal';
import DebugImageDetails, {
  modalCss,
} from 'app/components/events/interfaces/debugMeta-v2/debugImageDetails';
import {getFileName} from 'app/components/events/interfaces/debugMeta-v2/utils';
import GlobalModal from 'app/components/globalModal';

describe('Debug Meta - Image Details Candidates', function () {
  let wrapper: ReturnType<typeof mountWithTheme>;
  const projectId = 'foo';
  // @ts-expect-error
  const organization = TestStubs.Organization();
  // @ts-expect-error
  const event = TestStubs.Event();
  // @ts-expect-error
  const eventEntryDebugMeta = TestStubs.EventEntryDebugMeta();
  const {data} = eventEntryDebugMeta;
  const {images} = data;
  const debugImage = images[0];

  beforeAll(async function () {
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${projectId}/files/dsyms/?debug_id=${debugImage.debug_id}`,
      method: 'GET',
      body: [],
    });

    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: `/builtin-symbol-sources/`,
      method: 'GET',
      body: [],
    });

    wrapper = mountWithTheme(<GlobalModal />);

    openModal(
      modalProps => (
        <DebugImageDetails
          {...modalProps}
          image={debugImage}
          organization={organization}
          projectId={projectId}
          event={event}
        />
      ),
      {
        modalCss,
        onClose: jest.fn(),
      }
    );

    // @ts-expect-error
    await tick();
    wrapper.update();
  });

  it('Image Details Modal is open', () => {
    const fileName = wrapper.find('Title FileName');
    expect(fileName.text()).toEqual(getFileName(debugImage.code_file));
  });

  it('Image Candidates correctly sorted', () => {
    const candidates = wrapper.find('Candidate');

    // Check status order.
    // The UI shall sort the candidates by status. However, this sorting is not alphabetical but in the following order:
    // Permissions -> Failed -> Ok -> Deleted (previous Ok) -> Unapplied -> Not Found
    const statusColumns = candidates
      .find('StatusTag')
      .map(statusColumn => statusColumn.text());
    expect(statusColumns).toEqual(['Failed', 'Failed', 'Failed', 'Deleted']);

    const debugFileColumn = candidates.find('DebugFileColumn');

    // Check source names order.
    // The UI shall sort the candidates by source name (alphabetical)
    const sourceNames = debugFileColumn
      .find('SourceName')
      .map(sourceName => sourceName.text());
    expect(sourceNames).toEqual(['America', 'Austria', 'Belgium', 'Sentry']);

    // Check location order.
    // The UI shall sort the candidates by source location (alphabetical)
    const locations = debugFileColumn.find('Location').map(location => location.text());
    // Only 3 results are returned, as the UI only displays the Location component
    // when the location is defined and when it is not internal
    expect(locations).toEqual(['arizona', 'burgenland', 'brussels']);
  });
});
