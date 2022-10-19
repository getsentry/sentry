import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ErrorItem} from 'sentry/components/events/errorItem';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

describe('Issue error item', function () {
  it('expand subitems', function () {
    const {organization, router} = initializeOrg();

    render(
      <OrganizationContext.Provider value={organization}>
        <RouteContext.Provider
          value={{
            router,
            location: router.location,
            params: {},
            routes: [],
          }}
        >
          <ErrorItem
            error={{
              data: {
                mapping_uuid: 'd270a1a0-1970-3c05-cb09-2cb00b4335ee',
              },
              type: 'proguard_missing_mapping',
              message: 'A proguard mapping file was missing.',
            }}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.getByText('A proguard mapping file was missing.')).toBeInTheDocument();

    expect(screen.queryByText('Mapping Uuid')).not.toBeInTheDocument();

    userEvent.click(screen.getByLabelText('Expand'));

    expect(screen.getByText('Mapping Uuid')).toBeInTheDocument();
  });

  it('display redacted data', async function () {
    const {organization, router} = initializeOrg();

    render(
      <OrganizationContext.Provider value={organization}>
        <RouteContext.Provider
          value={{
            router,
            location: router.location,
            params: {},
            routes: [],
          }}
        >
          <ErrorItem
            error={{
              data: {
                image_path: '',
                image_uuid: '6b77ffb6-5aba-3b5f-9171-434f9660f738',
                message: '',
              },
              message: 'A required debug information file was missing.',
              type: 'native_missing_dsym',
            }}
            meta={{
              image_path: {'': {rem: [['project:2', 's', 0, 0]], len: 117}},
            }}
          />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    userEvent.click(screen.getByLabelText('Expand'));

    expect(screen.getByText('File Name')).toBeInTheDocument();
    expect(screen.getByText('File Path')).toBeInTheDocument();
    expect(screen.getAllByText(/redacted/)).toHaveLength(2);

    userEvent.hover(screen.getAllByText(/redacted/)[0]);

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of a data scrubbing rule in your project's settings"
        )
      ) // Fall back case
    ).toBeInTheDocument(); // tooltip description
  });
});
