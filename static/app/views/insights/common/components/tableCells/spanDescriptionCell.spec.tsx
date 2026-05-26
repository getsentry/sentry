import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ModuleName} from 'sentry/views/insights/types';

import {SpanDescriptionCell} from './spanDescriptionCell';

describe('SpanDescriptionCell', () => {
  const organization = OrganizationFixture();

  it('formats SQL descriptions with bold keywords via toSimpleMarkup', () => {
    render(
      <SpanDescriptionCell
        description="select id, name from users where active = 1"
        moduleName={ModuleName.DB}
        projectId={1}
      />,
      {organization}
    );

    // SQLishFormatter.toSimpleMarkup uppercases keywords and wraps them in <b>
    const boldElements = document.querySelectorAll('b');
    const boldText = Array.from(boldElements).map(el => el.textContent);
    expect(boldText).toEqual(['SELECT', 'FROM', 'WHERE']);
  });

  it('renders raw description for non-DB modules', () => {
    render(
      <SpanDescriptionCell
        description="https://example.com/api/resource"
        moduleName={ModuleName.RESOURCE}
        projectId={1}
        spanOp="resource.script"
      />,
      {organization}
    );

    expect(screen.getByText('https://example.com/api/resource')).toBeInTheDocument();
  });
});
