import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SentryAppRuleModal from 'sentry/views/alerts/issueRuleEditor/sentryAppRuleModal';

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

  function openSelectMenu(text) {
    const placeholder = screen.getByText(text);
    userEvent.type(placeholder, '{keyDown}');
  }

  const _submit = () => {
    userEvent.click(screen.getByText('Save Changes'));
    return screen.queryAllByText('Field is required');
  };

  const submitSuccess = () => {
    const errors = _submit();
    expect(errors).toHaveLength(0);
  };

  const submitErrors = errorCount => {
    const errors = _submit();
    expect(errors).toHaveLength(errorCount);
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
      />
    );
  };

  describe('Create UI Alert Rule', function () {
    it('should render the Alert Rule modal with the config fields', function () {
      createWrapper();
      const {required_fields, optional_fields} = defaultConfig;
      const allFields = [...required_fields, ...optional_fields];

      allFields.forEach(field => {
        expect(screen.getByText(field.label)).toBeInTheDocument();
      });
    });

    it('should raise validation errors when "Save Changes" is clicked with invalid data', function () {
      createWrapper();
      submitErrors(3);
    });

    it('should submit when "Save Changes" is clicked with valid data', function () {
      createWrapper();
      const titleInput = screen.getByTestId('title');
      const descriptionInput = screen.getByTestId('description');
      userEvent.type(titleInput, 'v');
      userEvent.type(descriptionInput, 'v');
      openSelectMenu('--');
      userEvent.click(screen.getByText('valor'));
      submitSuccess();
    });
  });
});
