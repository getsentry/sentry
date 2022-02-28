import {enzymeRender} from 'sentry-test/enzyme';

import {openModal} from 'sentry/actionCreators/modal';
import DebugImageDetails, {
  modalCss,
} from 'sentry/components/events/interfaces/debugMeta-v2/debugImageDetails';
import {getFileName} from 'sentry/components/events/interfaces/debugMeta-v2/utils';
import GlobalModal from 'sentry/components/globalModal';

describe('Debug Meta - Image Details Candidates', function () {
  let wrapper: ReturnType<typeof enzymeRender>;
  const projSlug = 'foo';
  const organization = TestStubs.Organization();
  const event = TestStubs.Event();
  const eventEntryDebugMeta = TestStubs.EventEntryDebugMeta();
  const {data} = eventEntryDebugMeta;
  const {images} = data;
  const debugImage = images[0];

  beforeAll(async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${projSlug}/files/dsyms/?debug_id=${debugImage.debug_id}`,
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/builtin-symbol-sources/`,
      method: 'GET',
      body: [],
    });

    wrapper = enzymeRender(<GlobalModal />);

    openModal(
      modalProps => (
        <DebugImageDetails
          {...modalProps}
          image={debugImage}
          organization={organization}
          projSlug={projSlug}
          event={event}
        />
      ),
      {
        modalCss,
        onClose: jest.fn(),
      }
    );

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
      .find('Status')
      .map(statusColumn => statusColumn.text());
    expect(statusColumns).toEqual(['Failed', 'Failed', 'Failed', 'Deleted']);

    const informationColumn = candidates.find('InformationColumn');

    // Check source names order.
    // The UI shall sort the candidates by source name (alphabetical)
    const sourceNames = informationColumn
      .find('[data-test-id="source_name"]')
      .map(sourceName => sourceName.text());
    expect(sourceNames).toEqual(['America', 'Austria', 'Belgium', 'Sentry']);

    // Check location order.
    // The UI shall sort the candidates by source location (alphabetical)
    const locations = informationColumn
      .find('FilenameOrLocation')
      .map(location => location.text());
    // Only 3 results are returned, as the UI only displays the Location component
    // when the location is defined and when it is not internal
    expect(locations).toEqual(['arizona', 'burgenland', 'brussels']);
  });
});
