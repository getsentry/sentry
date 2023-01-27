import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DebugMeta} from 'sentry/components/events/interfaces/debugMeta';
import {getFileName} from 'sentry/components/events/interfaces/debugMeta/utils';
import GlobalModal from 'sentry/components/globalModal';

describe('DebugMeta', function () {
  it('opens details modal', async function () {
    const eventEntryDebugMeta = TestStubs.EventEntryDebugMeta();
    const event = TestStubs.Event({entries: [eventEntryDebugMeta]});
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

    userEvent.click(screen.getByRole('button', {name: 'Show Details'}));

    userEvent.click(screen.getByRole('button', {name: 'View'}));

    expect(
      await screen.findByText(getFileName(eventEntryDebugMeta.data.images[0].code_file)!)
    ).toBeInTheDocument();
  });
});
