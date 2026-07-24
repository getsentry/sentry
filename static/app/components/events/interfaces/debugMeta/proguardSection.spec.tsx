import {EntryDebugMetaFixture} from 'sentry-fixture/eventEntry';
import {ImageFixture} from 'sentry-fixture/image';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProguardSection} from 'sentry/components/events/interfaces/debugMeta/proguardSection';

describe('ProguardSection', () => {
  const {organization, project} = initializeOrg();
  const uuid = '9d2e35ba-c1c1-4b7a-9575-8f3b0c1b4a12';

  it('links the proguard uuid to the project proguard settings', async () => {
    const entry = {
      ...EntryDebugMetaFixture(),
      data: {images: [ImageFixture({type: 'proguard', uuid})]},
    };

    render(<ProguardSection data={entry.data} projectSlug={project.slug} />, {
      organization,
    });

    expect(screen.getByText('ProGuard Mapping')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {name: 'View ProGuard Mapping Section'})
    );
    expect(screen.getByText('UUID')).toBeInTheDocument();
    expect(screen.getByText(uuid)).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'Open in Settings'});
    expect(link).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/${project.slug}/debug-symbols/?query=${uuid}`
    );
  });

  it('renders nothing without a proguard image', () => {
    const entry = EntryDebugMetaFixture();

    const {container} = render(
      <ProguardSection data={entry.data} projectSlug={project.slug} />,
      {organization}
    );

    expect(container).toBeEmptyDOMElement();
  });
});
