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
        choices: [
          ['valor', 'valor'],
          ['mystic', 'mystic'],
          ['instinct', 'instinct'],
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
        sentryAppInstallationUuid={sentryAppInstallation.uuid}
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
      const titleInput = wrapper.find('[data-test-id="title"] input').at(0);
      const descriptionInput = wrapper
        .find('[data-test-id="description"] textarea')
        .at(0);
      const channelInput = wrapper.find('[data-test-id="channel"] input').at(0);
      changeInputValue(titleInput, 'v');
      changeInputValue(descriptionInput, 'v');
      changeInputValue(channelInput, 'v');
      selectByValue(wrapper, 'valor', {name: 'channel', control: true});
      submitSuccess(wrapper);
    });
  });
});
