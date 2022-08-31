import {mountGlobalModal} from 'sentry-test/modal';

import {openReprocessEventModal} from 'sentry/actionCreators/modal';
import ModalStore from 'sentry/stores/modalStore';

const group = TestStubs.Group({
  id: '1337',
  pluginActions: [],
  pluginIssues: [],
});

const organization = TestStubs.Organization({
  id: '4660',
  slug: 'org',
  features: ['reprocessing-v2'],
});

async function mountComponent() {
  const modal = await mountGlobalModal();

  openReprocessEventModal({organization, groupId: group.id});

  await tick();
  await tick();
  modal.update();

  return modal;
}

describe('ReprocessEventModal', function () {
  let wrapper: any;

  beforeEach(async function () {
    wrapper = await mountComponent();
  });

  it('modal is open', () => {
    expect(wrapper.find('Header').text()).toEqual('Reprocess Events');
  });

  it('form fields & info', () => {
    // some info about reprocessing
    const introduction = wrapper.find('Introduction');
    expect(introduction).toBeTruthy();
    expect(introduction).toHaveLength(2);

    // Reprocess impacts
    expect(introduction.at(0).text()).toEqual(
      'Reprocessing applies new debug files and grouping enhancements to this Issue. Please consider these impacts:'
    );
    const impacts = wrapper.find('StyledList');
    expect(impacts).toBeTruthy();
    expect(impacts.length).toBeGreaterThan(0);

    // Docs info
    expect(introduction.at(1).text()).toEqual(
      'For more information, please refer to the documentation.'
    );

    // Form
    const form = wrapper.find('Form');
    expect(form).toBeTruthy();

    // Number of events to be reprocessed field
    const reprocessQuantityField = form.find('NumberField');
    expect(reprocessQuantityField).toBeTruthy();

    // Remaining events action field
    const remainingEventsActionField = form.find('RadioField');
    expect(remainingEventsActionField).toBeTruthy();
  });

  it('reprocess all events', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/reprocessing/`,
      method: 'POST',
      body: [],
    });

    jest.spyOn(window.location, 'reload').mockImplementation(() => {});
    const closeModalFunc = jest.spyOn(ModalStore, 'closeModal');

    // Number of events to be reprocessed field
    const reprocessQuantityField = wrapper.find('NumberField input');
    expect(reprocessQuantityField.props().placeholder).toEqual('Reprocess all events');
    expect(reprocessQuantityField.props().value).toEqual(undefined);

    const submitButton = wrapper.find('[data-test-id="form-submit"]').hostNodes();

    submitButton.simulate('submit');

    await tick();
    wrapper.update();

    expect(window.location.reload).toHaveBeenCalled();
    expect(closeModalFunc).toHaveBeenCalled();
  });
});
