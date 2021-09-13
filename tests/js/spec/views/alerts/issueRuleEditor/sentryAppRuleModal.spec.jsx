// TODO(leander): Remove this once the test is configured
/* eslint-disable jest/no-disabled-tests */

import {mountWithTheme} from 'sentry-test/enzyme';
import {changeInputValue, selectByValue} from 'sentry-test/select-new';

import SentryAppRuleModal from 'app/views/alerts/issueRuleEditor/sentryAppRuleModal';

describe('SentryAppRuleModal', function () {
  const modalElements = {
    Header: p => p.children,
    Body: p => p.children,
    Footer: p => p.children,
  };
  let sentryApp;
  let sentryAppInstallation;

  beforeEach(function () {
    sentryApp = TestStubs.SentryApp();
    sentryAppInstallation = TestStubs.SentryAppInstallation({sentryApp});
  });

  const _submit = wrapper => {
    wrapper.find('Button[data-test-id="form-submit"]').simulate('submit');
    return wrapper.find('FieldErrorReason');
  };

  const submitSuccess = wrapper => {
    const errors = _submit(wrapper);
    expect(errors).toHaveLength(0);
  };

  const submitErrors = (wrapper, errorCount) => {
    const errors = _submit(wrapper);
    expect(errors).toHaveLength(errorCount);
    expect(errors.first().text()).toEqual('Field is required');
  };

  const defaultConfig = {
    uri: '/integration/test/',
    required_fields: [
      {
        type: 'text',
        label: 'Alert Title',
        name: 'title',
      },
      {
        type: 'textarea',
        label: 'Alert Description',
        name: 'description',
      },
      {
        type: 'select',
        label: 'Team Channel',
        name: 'channel',
        options: [
          ['#valor', 'valor'],
          ['#mystic', 'mystic'],
          ['#instinct', 'instinct'],
        ],
      },
    ],
    optional_fields: [
      {
        type: 'text',
        label: 'Extra Details',
        name: 'extra',
      },
    ],
  };

  const createWrapper = (props = {}) => {
    return mountWithTheme(
      <SentryAppRuleModal
        {...modalElements}
        sentryAppInstallationId={sentryAppInstallation.uuid}
        appName={sentryApp.name}
        config={defaultConfig}
        action="create"
        onSubmitSuccess={() => {}}
        {...props}
      />,
      TestStubs.routerContext()
    );
  };

  describe('Create UI Alert Rule', function () {
    it('should render the Alert Rule modal with the config fields', async function () {
      const wrapper = createWrapper();
      const formFields = wrapper.find('FormField');
      const {required_fields, optional_fields} = defaultConfig;
      const allFields = [...required_fields, ...optional_fields];

      allFields.forEach((field, index) => {
        expect(formFields.at(index).prop('label')).toEqual(field.label);
        expect(formFields.at(index).prop('name')).toEqual(field.name);
      });
    });

    it('should raise validation errors when "Save Changes" is clicked with invalid data', async function () {
      const wrapper = createWrapper();
      submitErrors(wrapper, 3);
    });

    it('should submit when "Save Changes" is clicked with valid data', async function () {
      const wrapper = createWrapper();
      const projectInput = wrapper.find('[data-test-id="channel"] input').at(0);
      changeInputValue(projectInput, '#');

      await tick();
      wrapper.update();

      expect(wrapper.find('[label="#valor"]').exists()).toBe(true);
      expect(wrapper.find('[label="#mystic"]').exists()).toBe(true);
      expect(wrapper.find('[label="#instinct"]').exists()).toBe(true);

      await tick();
      wrapper.update();
      selectByValue(wrapper, 'valor', {name: 'channel'});

      submitSuccess(wrapper);
    });
  });

  // describe.skip('Create Rule', function () {
  //   it('should save the modal data when "Apply Changes" is clicked with valid data', async function () {
  //     const wrapper = createWrapper();
  //     selectByValue(wrapper, 'a', {name: 'reporter'});
  //     submitSuccess(wrapper);
  //   });

  //   it('should raise validation errors when "Apply Changes" is clicked with invalid data', async function () {
  //     // This doesn't test anything TicketRules specific but I'm leaving it here as an example.
  //     const wrapper = createWrapper();
  //     submitErrors(wrapper, 1);
  //   });

  //   it('should reload fields when an "updatesForm" field changes', async function () {
  //     const wrapper = createWrapper();
  //     selectByValue(wrapper, 'a', {name: 'reporter'});

  //     addMockConfigsAPICall({
  //       label: 'Assignee',
  //       required: true,
  //       choices: [['b', 'b']],
  //       type: 'select',
  //       name: 'assignee',
  //     });

  //     selectByValue(wrapper, '10000', {name: 'issuetype'});
  //     selectByValue(wrapper, 'b', {name: 'assignee'});

  //     submitSuccess(wrapper);
  //   });

  //   it('should persist values when the modal is reopened', async function () {
  //     const wrapper = createWrapper({data: {reporter: 'a'}});
  //     submitSuccess(wrapper);
  //   });

  //   it('should get async options from URL', async function () {
  //     const wrapper = createWrapper();
  //     addMockConfigsAPICall({
  //       label: 'Assignee',
  //       required: true,
  //       url: 'http://example.com',
  //       type: 'select',
  //       name: 'assignee',
  //     });
  //     selectByValue(wrapper, '10000', {name: 'issuetype'});

  //     addMockUsersAPICall(['Marcos']);
  //     await selectByQuery(wrapper, 'Marcos', {name: 'assignee'});

  //     submitSuccess(wrapper);
  //   });
  // });
});
