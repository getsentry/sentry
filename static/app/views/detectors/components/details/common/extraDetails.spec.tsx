import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DetectorExtraDetails} from './extraDetails';

describe('DetectorExtraDetails.CreatedBy', () => {
  const organization = OrganizationFixture();
  const user = UserFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders "Sentry" when createdBy is null', () => {
    const detector = MetricDetectorFixture({createdBy: null});

    render(<DetectorExtraDetails.CreatedBy detector={detector} />, {organization});

    expect(screen.getByText('Sentry')).toBeInTheDocument();
  });

  it('renders the user name when user is found', async () => {
    const detector = MetricDetectorFixture({createdBy: user.id});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/${user.id}/`,
      body: user,
    });

    render(<DetectorExtraDetails.CreatedBy detector={detector} />, {organization});

    expect(await screen.findByText(user.name)).toBeInTheDocument();
  });

  it('renders "Deactivated user" when user cannot be found', async () => {
    const detector = MetricDetectorFixture({createdBy: user.id});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/${user.id}/`,
      statusCode: 404,
      body: {detail: 'Not found'},
    });

    render(<DetectorExtraDetails.CreatedBy detector={detector} />, {organization});

    expect(await screen.findByText('Deactivated user')).toBeInTheDocument();
  });
});
