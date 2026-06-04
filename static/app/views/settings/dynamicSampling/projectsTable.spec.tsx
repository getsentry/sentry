import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {ProjectionSamplePeriod} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

import {ProjectsTable} from './projectsTable';

jest.spyOn(window.Element.prototype, 'getBoundingClientRect').mockReturnValue({
  height: 400,
  width: 500,
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 500,
  bottom: 400,
  toJSON: jest.fn(),
});

describe('ProjectsTable', () => {
  const organization = OrganizationFixture({
    access: ['org:write'],
  });

  const project = ProjectFixture();

  const defaultProps = {
    items: [
      {
        project,
        count: 1000,
        ownCount: 800,
        sampleRate: '10',
        initialSampleRate: '10',
        subProjects: [],
      },
    ],
    period: '24h' as ProjectionSamplePeriod,
    rateHeader: 'Sample Rate',
    isLoading: false,
    emptyMessage: 'No projects found',
  };

  it('disables input when user does not have access', () => {
    const orgWithoutAccess = OrganizationFixture({
      access: [], // No org:write access
    });

    render(<ProjectsTable {...defaultProps} canEdit />, {
      organization: orgWithoutAccess,
    });

    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });

  it('enables input when user has access and canEdit is true', () => {
    render(<ProjectsTable {...defaultProps} canEdit />, {
      organization,
    });

    expect(screen.getByRole('spinbutton')).toBeEnabled();
  });

  it('disables input when canEdit is false, regardless of access', () => {
    render(<ProjectsTable {...defaultProps} canEdit={false} />, {
      organization,
    });

    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });

  it('does not show settings button when user does not have project:write access', () => {
    render(<ProjectsTable {...defaultProps} />, {
      organization,
    });

    expect(
      screen.queryByRole('button', {name: 'Open Project Settings'})
    ).not.toBeInTheDocument();
  });

  it('shows settings button only when user has project:write access', () => {
    const orgWithProjectAccess = OrganizationFixture({
      access: ['org:write', 'project:write'],
    });

    render(<ProjectsTable {...defaultProps} />, {
      organization: orgWithProjectAccess,
    });

    expect(
      screen.getByRole('button', {name: 'Open Project Settings'})
    ).toBeInTheDocument();
  });
});
