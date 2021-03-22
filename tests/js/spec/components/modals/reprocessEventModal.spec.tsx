import {mountGlobalModal} from 'sentry-test/modal';

import {openReprocessEventModal} from 'app/actionCreators/modal';
import ModalActions from 'app/actions/modalActions';
// @ts-expect-error
const group = TestStubs.Group({
  id: '1337',
  pluginActions: [],
  pluginIssues: [],
});

// @ts-expect-error
const organization = TestStubs.Organization({
  id: '4660',
  slug: 'org',
  features: ['reprocessing-v2'],
});

async function renderComponent() {
  const modal = await mountGlobalModal();

  openReprocessEventModal({organization, groupId: group.id});

  // @ts-expect-error
  await tick();
  // @ts-expect-error
  await tick();
  modal.update();

  return modal;
}

describe('ReprocessEventModal', function () {
  let wrapper: any;

  beforeAll(async function () {
    wrapper = await renderComponent();
  });

  it('modal is open', () => {
    expect(wrapper.find('[data-test-id="modal-title"]').text()).toEqual(
      'Reprocess Events'
    );
  });

  it('form fields & info', () => {
    // some info about reprocessing
    const introduction = wrapper.find('Introduction');
    expect(introduction).toBeTruthy();
    expect(introduction).toHaveLength(2);

    // Reprocess impacts
    expect(introduction.at(0).text()).toEqual(
      'Reprocessing applies any new debug files or grouping configuration to an Issue. Before you give it a try, you should probably consider these impacts:'
    );
    const impacts = wrapper.find('StyledList');
    expect(impacts).toBeTruthy();
    expect(impacts.length).toBeGreaterThan(0);

    // Docs info
    expect(introduction.at(1).text()).toEqual(
      'For more information please refer to the documentation on reprocessing.'
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
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/reprocessing/`,
      method: 'POST',
      body: [],
    });

    jest.spyOn(window.location, 'reload').mockImplementation(() => {});
    const closeModalFunc = jest.spyOn(ModalActions, 'closeModal');

    // Number of events to be reprocessed field
    const reprocessQuantityField = wrapper.find('NumberField input');
    expect(reprocessQuantityField.props().placeholder).toEqual('Reprocess all events');
    expect(reprocessQuantityField.props().value).toEqual(undefined);

    const submitButton = wrapper.find('[data-test-id="form-submit"]').hostNodes();

    submitButton.simulate('submit');

    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(window.location.reload).toHaveBeenCalled();
    expect(closeModalFunc).toHaveBeenCalled();
  });
});
