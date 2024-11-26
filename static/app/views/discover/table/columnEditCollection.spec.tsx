import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import ColumnEditCollection from 'sentry/views/discover/table/columnEditCollection';

describe('ColumnEditCollection', () => {
  let organization: Organization;

  beforeEach(() => {
    organization = OrganizationFixture();
  });

  it('does not render the Add an Equation button when equations are not supported', () => {
    render(
      <ColumnEditCollection
        columns={[]}
        fieldOptions={{}}
        onChange={jest.fn()}
        organization={organization}
        supportsEquations={false}
      />
    );
    expect(screen.queryByText('Add an Equation')).not.toBeInTheDocument();
  });

  it('renders the Add an Equation button when equations are supported', () => {
    render(
      <ColumnEditCollection
        columns={[]}
        fieldOptions={{}}
        onChange={jest.fn()}
        organization={organization}
        supportsEquations
      />
    );

    expect(screen.getByText('Add an Equation')).toBeInTheDocument();
  });
});
