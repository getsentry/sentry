import {Fragment} from 'react';
import {Event as EventFixture} from 'sentry-fixture/event';
import {EntryDebugMeta as EventEntryDebugMetaFixture} from 'sentry-fixture/eventEntry';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DebugMeta} from 'sentry/components/events/interfaces/debugMeta';
import {getFileName} from 'sentry/components/events/interfaces/debugMeta/utils';
import GlobalModal from 'sentry/components/globalModal';

describe('DebugMeta', function () {
  it('opens details modal', async function () {
    const eventEntryDebugMeta = EventEntryDebugMetaFixture();
    const event = EventFixture({entries: [eventEntryDebugMeta]});
    const {organization, project, router} = initializeOrg();
    const routerProps = {router, location: router.location};

    render(
      <Fragment>
        <GlobalModal />
        <DebugMeta
          organization={organization}
          projectSlug={project.slug}
          event={event}
          data={eventEntryDebugMeta.data}
          {...routerProps}
        />
      </Fragment>
    );

    await screen.findByRole('heading', {name: 'Images Loaded'});

    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));

    await userEvent.click(screen.getByRole('button', {name: 'View'}));

    expect(
      await screen.findByText(getFileName(eventEntryDebugMeta.data.images[0]?.code_file)!)
    ).toBeInTheDocument();
  });
});
